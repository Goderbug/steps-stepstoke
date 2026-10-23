import { verificationKey, recordVerification, verificationOf, clearVerifications } from "../../src/ui/verification";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useActionScope } from "../../src/ui/actionScope";
import { signingAccount } from "../../src/domain/types";
import { ChainAdapter, type LocalConfig, type Provider } from "../../src/domain/chainAdapter";
import { FixtureAdapter, DEMO_ACCOUNTS } from "../../src/domain/fixtureAdapter";
import { safeFileName } from "../../src/domain/files";
import { Workspace } from "../../src/ui/Workspace";
import { readWorkspaceSnapshot } from "../../src/ui/snapshot";
import config from "../fixtures/local-config.json";

beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};

describe("delayed signing cancellation at the production wallet boundary",()=>{
  it.each(["verify","simulation","nonce","final identity"])("closing during %s prevents eth_sendTransaction",async stage=>{
    const gate=deferred();let reached=false;let accountReads=0;
    const request=vi.fn(async({method}:{method:string})=>{
      if(method==="eth_accounts"){accountReads++;if(stage==="final identity"&&accountReads===3){reached=true;await gate.promise;}return [DEMO_ACCOUNTS[0].address];}
      if(method==="eth_chainId")return "0x7a69";
      if(method==="eth_getTransactionCount"){if(stage==="nonce"){reached=true;await gate.promise;}return "0x0";}
      if(method==="eth_sendTransaction")throw new Error("Unexpected wallet submission");
      return "0x";
    });
    const wallet={request} as Provider;
    const adapter=new ChainAdapter(config as LocalConfig,async()=>wallet);
    adapter.verify=vi.fn(async()=>{if(stage==="verify"){reached=true;await gate.promise;}});
    adapter.provider.request=vi.fn(async({method})=>{if(method==="eth_call"&&stage==="simulation"){reached=true;await gate.promise;}return "0x";});
    const hook=renderHook(()=>useActionScope("account:31337"));
    const operation=adapter.createBranch(signingAccount(DEMO_ACCOUNTS[0],hook.result.current),{title:"Cancelled preparation",goal:"No delayed signature"});
    const rejection=expect(operation).rejects.toThrow("Preparation cancelled");
    await waitFor(()=>expect(reached).toBe(true));hook.unmount();gate.resolve();await rejection;
    expect(request.mock.calls.filter(([r])=>r.method==="eth_sendTransaction")).toHaveLength(0);
  });
  it.each(["account B:31337","account A:1"])("invalidates the captured guard on identity change to %s",identity=>{
    const hook=renderHook(({who})=>useActionScope(who),{initialProps:{who:"account A:31337"}});
    const old=hook.result.current;hook.rerender({who:identity});expect(old).toThrow("Preparation cancelled");expect(hook.result.current).not.toThrow();
  });
  it("does not sign a delayed demo action after unmount",async()=>{
    const a=await FixtureAdapter.create({latency:10,reset:true});const hook=renderHook(()=>useActionScope("demo"));
    const before=(await a.listBranches()).length;const action=a.createBranch(signingAccount(DEMO_ACCOUNTS[0],hook.result.current),{title:"Cancelled",goal:"No branch"});const rejection=expect(action).rejects.toThrow("Preparation cancelled");hook.unmount();await rejection;expect((await a.listBranches()).length).toBe(before);
  });
});

describe("consistent read recovery",()=>{
  it("refetches both branch and history after a mixed read",async()=>{
    const a=await FixtureAdapter.create({latency:0,reset:true});const branch=await a.getBranch("fx-branch-1"),history=await a.getHistory(branch.id);
    const b=vi.spyOn(a,"getBranch").mockResolvedValueOnce({...branch,latestCheckpoint:"not-in-history"}).mockResolvedValue(branch);const h=vi.spyOn(a,"getHistory").mockResolvedValue(history);
    expect((await readWorkspaceSnapshot(a,branch.id)).consistent).toBe(true);expect(b).toHaveBeenCalledTimes(2);expect(h).toHaveBeenCalledTimes(2);
  });
  it("offers a visible read-only Retry and recovers without reload or signature",async()=>{
    const a=await FixtureAdapter.create({latency:0,reset:true});const branch=await a.getBranch("fx-branch-1");let mixed=true;
    vi.spyOn(a,"getBranch").mockImplementation(async()=>mixed?{...branch,latestCheckpoint:"mixed"}:branch);
    const history=vi.spyOn(a,"getHistory");const approve=vi.spyOn(a,"approve"),sponsor=vi.spyOn(a,"sponsor");
    const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={qc}><Workspace adapter={a} account={{address:"",chainId:0,label:"Public reader"}} branchId={branch.id}/></QueryClientProvider>);
    const retry=await screen.findByRole("button",{name:"Retry reads"});expect(screen.queryByRole("button",{name:"Continue"})).not.toBeInTheDocument();mixed=false;fireEvent.click(retry);
    await screen.findByRole("heading",{name:"Round 3 output"});expect(history.mock.calls.length).toBeGreaterThanOrEqual(3);expect(approve).not.toHaveBeenCalled();expect(sponsor).not.toHaveBeenCalled();
    // Read refresh must retain an explicit historical selection.
    fireEvent.click(screen.getByRole("button",{name:/Select Round 1/}));await screen.findByRole("heading",{name:"Round 1 output"});
    await act(()=>qc.invalidateQueries());expect(screen.getByRole("heading",{name:"Round 1 output"})).toBeInTheDocument();
  });
});

it("uses a sanitized descriptor.path basename and preserves extensions under truncation",()=>{
  expect(safeFileName("docs/../../dist/index.html")).toBe("index.html");
  expect(safeFileName("images/"+"x".repeat(200)+".png")).toMatch(/^x{92}\.png$/);
  expect(safeFileName("..\\notes\\unsafe\u0000.md")).toBe("unsafe_.md");
});

it("never carries verification across different origin branches or versions",async()=>{
  clearVerifications();const a=await FixtureAdapter.create({latency:0,reset:true});const asset=(await a.getHistory("fx-branch-1"))[0].assets[0];recordVerification(asset,"verified");
  for(const changed of [{...asset,originBranchId:"another-producer"},{...asset,revision:asset.revision+1},{...asset,originCheckpoint:"another-checkpoint"}]){expect(verificationKey(changed)).not.toBe(verificationKey(asset));expect(verificationOf(changed)).toBeNull();}
});

it("labels original and successful replacement hashes separately in the authenticated attempt",async()=>{
  const a=await FixtureAdapter.create({latency:0,reset:true}),branch="fx-branch-1";
  const quote=await a.quoteFee("fx-prop-1");await a.approve(DEMO_ACCOUNTS[0],quote,quote.price);
  const sp=await a.sponsor(DEMO_ACCOUNTS[0],"fx-prop-1",quote.price,quote);
  const original=`0x${"a1".padStart(64,"0")}` as const,replacement=`0x${"b2".padStart(64,"0")}` as const;
  vi.spyOn(a,"getSponsorships").mockResolvedValue([{...sp,txHash:original,replacementHash:replacement,replacementState:"CONFIRMED"}]);
  const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={qc}><Workspace adapter={a} account={{address:"",chainId:0,label:"Public reader"}} branchId={branch}/></QueryClientProvider>);
  const disclosure=await screen.findByText("Transaction and attempt identity");fireEvent.click(disclosure);
  expect(screen.getByText("Original transaction").nextElementSibling).toHaveTextContent(original);
  expect(screen.getByText("Replacement transaction").nextElementSibling).toHaveTextContent(replacement);
  expect(screen.getByText("Replacement outcome").nextElementSibling).toHaveTextContent("CONFIRMED");
  expect(screen.getAllByTestId(/^sp-/)).toHaveLength(1);
});

it("reload reconciliation preserves a missing callback outcome instead of applying the new demo success default",async()=>{
  const a=await FixtureAdapter.create({latency:0,reset:true});a.controls.callbackOutcome="missing";a.controls.txOutcome="unknown";
  const q=await a.quoteFee("fx-prop-1");await a.approve(DEMO_ACCOUNTS[0],q,q.price);
  const sp=await a.sponsor(DEMO_ACCOUNTS[0],"fx-prop-1",q.price,q);
  const reloaded=await FixtureAdapter.create({latency:0});
  expect(reloaded.controls.callbackOutcome).toBe("accepted");
  const result=await reloaded.reconcile({sponsorshipId:sp.id,branchId:sp.branchId,proposalId:sp.proposalId,account:sp.sponsor,chainId:31337,adapterKind:"fixture",txHash:sp.txHash,nonce:sp.nonce,savedAt:new Date().toISOString()});
  expect(result?.stages.purchase).toBe("confirmed");expect(result?.stages.callback).toBe("pending");expect(result?.checkpointId).toBeNull();
  expect(await reloaded.getSponsorships(sp.branchId)).toHaveLength(1);
});
