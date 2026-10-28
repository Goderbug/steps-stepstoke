// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StepsBranch, IIntake} from "../src/StepsBranch.sol";
import {MockToken} from "../src/MockToken.sol";

interface Vm {
    struct Log { bytes32[] topics; bytes data; address emitter; }
    function warp(uint256) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
}

interface TokenPull { function transferFrom(address,address,uint256) external returns(bool); }

// Deliberately independent of the candidate's IIntake type. The tuple ABI, real token
// pull, failure registration and fixed callback stipend model the public Intake contract.
contract DocumentedIntake {
    struct Callback { address target; bytes4 selector; }
    struct Request { address target; bytes4 success; bytes4 failure; bool completed; }
    mapping(bytes32=>Request) public requests;
    uint256 public nonce;
    bool public reject;
    uint8 public badId;
    bool public lastDelivered;
    event Delivery(bytes32 indexed requestId, uint8 status, bool delivered, uint256 callGas);
    function setReject(bool value) external { reject=value; }
    function setBadId(uint8 value) external { badId=value; }
    function requestWithFailure(bytes32 action, bytes calldata body, Callback calldata cb, bytes4 failure, address asset, uint256 amount) external returns(bytes32 id) {
        require(!reject,"intake rejection");
        require(action==bytes32("job.open@job-1") && body.length>0,"request shape");
        require(cb.target==msg.sender && cb.selector==0x4374622e && failure==0x5a0df71e,"callback shape");
        require(TokenPull(asset).transferFrom(msg.sender,address(this),amount),"token pull");
        id=badId==1?bytes32(0):badId==2?bytes32(uint256(1)):bytes32(++nonce);
        requests[id]=Request(cb.target,cb.selector,failure,false);
    }
    function deliver(bytes32 id, bytes32 hash, string calldata uri) external returns(bool delivered) {
        Request storage r=requests[id];
        require(!r.completed,"already completed");
        r.completed=true;
        uint256 beforeGas=gasleft();
        (delivered,)=r.target.call{gas:200_000}(abi.encodeWithSelector(r.success,id,hash,uri));
        uint256 used=beforeGas-gasleft();
        lastDelivered=delivered;
        emit Delivery(id,0,delivered,used);
    }
    function fail(bytes32 id, uint8 status, bytes32 reason) external returns(bool delivered) {
        Request storage r=requests[id];
        require(!r.completed,"already completed");
        r.completed=true;
        uint256 beforeGas=gasleft();
        (delivered,)=r.target.call{gas:200_000}(abi.encodeWithSelector(r.failure,id,status,reason,uint16(0),uint16(0),bytes("")));
        uint256 used=beforeGas-gasleft();
        lastDelivered=delivered;
        emit Delivery(id,status,delivered,used);
    }
}

contract FalseToken {
    function balanceOf(address) external pure returns(uint256) { return 100 ether; }
    function transferFrom(address,address,uint256) external pure returns(bool) { return false; }
    function approve(address,uint256) external pure returns(bool) { return false; }
}

contract FalseApprovalToken {
    mapping(address=>uint256) public balanceOf;
    function mint(address a,uint256 n) external { balanceOf[a]+=n; }
    function transferFrom(address a,address b,uint256 n) external returns(bool) { balanceOf[a]-=n;balanceOf[b]+=n;return true; }
    function approve(address,uint256) external pure returns(bool) { return false; }
}

contract ReentrantToken {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    address public target;
    bool public reentered;
    function setup(address a) external { target=a; }
    function mint(address a,uint256 n) external { balanceOf[a]+=n; }
    function approve(address s,uint256 n) external returns(bool) { allowance[msg.sender][s]=n;return true; }
    function transferFrom(address a,address b,uint256 n) external returns(bool) {
        if(msg.sender==target) { (reentered,)=target.call(abi.encodeWithSignature("forkFromOrigin()")); }
        balanceOf[a]-=n;allowance[a][msg.sender]-=n;balanceOf[b]+=n;return true;
    }
}

contract StepsBranchTest {
    Vm private constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes internal constant BODY='{"objective":"Build the next step","skill":"research-report"}';
    string internal constant URI="ipfs://bafybeiddvhj22nmr4vbvcukumtqoi6sdnheqqxqidqod36lxb73zyi7pny/result.json";
    bytes internal constant RESULT='{"jobId":"test-job","files":[]}';
    uint256 internal constant PRICE=0.5 ether;
    StepsBranch internal ledger;
    DocumentedIntake internal intake;
    MockToken internal token;
    bytes32 internal initialRequest;

    function setUp() public {
        token=new MockToken();intake=new DocumentedIntake();
        ledger=new StepsBranch(IIntake(address(intake)),address(token),PRICE,address(this));
        token.mint(address(this),100 ether);token.approve(address(ledger),type(uint256).max);
        initialRequest=_fund(0,bytes32(0));
    }
    function _fund(uint64 branchId,bytes32 anchor) internal returns(bytes32) {
        uint256 id=ledger.propose(branchId,anchor,BODY);
        return ledger.fundWithPayment(id,BODY,PRICE);
    }
    function _success(bytes32 request) internal {
        require(intake.deliver(request,keccak256(RESULT),URI),"callback failed");
    }
    function _status(uint256 id) internal view returns(StepsBranch.Status s) { (,,s,,,,,,,)=ledger.proposals(id); }
    function _head(uint64 id) internal view returns(bytes32 h) { (h,,,)=ledger.branches(id); }
    function _pending(uint64 id) internal view returns(uint64 p) { (,,,p)=ledger.branches(id); }

    function testOfficialTupleAbiAndNestedPayment() public view {
        require(IIntake.requestWithFailure.selector==bytes4(keccak256("requestWithFailure(bytes32,bytes,(address,bytes4),bytes4,address,uint256)")),"ABI");
        require(token.balanceOf(address(this))==100 ether-PRICE,"payer debited");
        require(token.balanceOf(address(intake))==PRICE && token.balanceOf(address(ledger))==0,"payment path");
        require(token.allowance(address(ledger),address(intake))==0,"residual approval");
        require(ledger.proposalOfRequest(initialRequest)==1,"zero-id sentinel");
    }
    function testFirstRealisticUriCallbackFitsStipend() public {
        _success(initialRequest);
        require(ledger.count()==1 && _status(0)==StepsBranch.Status.Succeeded && _pending(0)==0,"settlement");
        StepsBranch.CheckpointView memory c=ledger.checkpoint(0);
        require(c.uriHash==keccak256(bytes(URI)) && c.resultHash==keccak256(RESULT) && c.parent==0 && c.revision==1,"receipt");
    }
    function testSubsequentCallbackFitsStipendAndPinsParent() public {
        _success(initialRequest);bytes32 head=_head(0);
        bytes32 next=_fund(0,head);_success(next);
        StepsBranch.CheckpointView memory c=ledger.checkpoint(1);
        require(c.parent==head && c.revision==2 && c.branchId==0,"parent");
    }
    function testHttpFallbackUriFitsStipend() public {
        require(intake.deliver(initialRequest,keccak256(RESULT),"https://api.imd.fun/intake-results/0x9624f208a2ab5fb418e096e46b563eb7609bd48ab0be58440a9481e83ef62894"),"http callback");
    }
    function testMaxEventUriFitsStipend() public {
        bytes memory uri=new bytes(2048);
        for(uint256 i;i<uri.length;i++) uri[i]=0x61;
        require(intake.deliver(initialRequest,keccak256(RESULT),string(uri)),"max event URI");
        require(ledger.checkpoint(0).uriHash==keccak256(uri),"uri committed");
    }
    function testLargeUriIsCommittedWithoutUnboundedEvent() public {
        bytes memory uri=new bytes(16384);
        require(intake.deliver(initialRequest,keccak256(RESULT),string(uri)),"large URI");
        require(ledger.checkpoint(0).uriHash==keccak256(uri),"large uri commitment");
    }
    function testRefusalUnlocksBranchWithoutCheckpoint() public {
        require(intake.fail(initialRequest,1,"refused"),"refusal hook");
        require(_status(0)==StepsBranch.Status.Refused && _pending(0)==0 && ledger.count()==0,"refused state");
        (,,,,,,,,bytes32 reason,)=ledger.proposals(0);require(reason==bytes32("refused"),"reason");
        _success(_fund(0,bytes32(0)));require(ledger.count()==1,"new attempt");
    }
    function testNoResultUnlocksBranchWithoutChangingHead() public {
        _success(initialRequest);bytes32 head=_head(0);
        bytes32 next=_fund(0,head);
        require(intake.fail(next,2,"blocked"),"failure hook");
        require(_status(1)==StepsBranch.Status.Failed && _head(0)==head && ledger.count()==1,"failed state");
        require(token.balanceOf(address(intake))==2*PRICE,"failure does not refund");
    }
    function testUnknownAndForeignCallbacksRejected() public {
        vm.expectRevert(StepsBranch.NotIntake.selector);ledger.onResult(initialRequest,bytes32(0),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.UnknownRequest.selector);ledger.onResult(bytes32(uint256(777)),bytes32(0),URI);
        vm.expectRevert(StepsBranch.NotIntake.selector);ledger.onFailure(initialRequest,1,"refused",0,0,"");
    }
    function testDuplicateSuccessAndLateFailureRejected() public {
        _success(initialRequest);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onResult(initialRequest,bytes32(0),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onFailure(initialRequest,2,"blocked",0,0,"");
        require(ledger.count()==1,"no duplicate");
    }
    function testLateSuccessAfterFailureCannotMoveHead() public {
        require(intake.fail(initialRequest,2,"blocked"),"failure hook");
        _success(_fund(0,bytes32(0)));bytes32 head=_head(0);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onResult(initialRequest,bytes32(0),URI);
        require(_head(0)==head && ledger.count()==1,"late success changed head");
    }
    function testInvalidFailureStatusCannotSettle() public {
        vm.prank(address(intake));vm.expectRevert(StepsBranch.InvalidFailureStatus.selector);ledger.onFailure(initialRequest,0,"bad",0,0,"");
        require(_pending(0)==1 && _status(0)==StepsBranch.Status.Pending,"invalid status");
    }
    function testSecondPaidRequestOnSameBranchRejectedBeforeSpending() public {
        uint256 id=ledger.propose(0,bytes32(0),BODY);uint256 balance=token.balanceOf(address(this));
        vm.expectRevert(StepsBranch.BranchBusy.selector);ledger.fundWithPayment(id,BODY,PRICE);
        require(token.balanceOf(address(this))==balance && _status(id)==StepsBranch.Status.Draft,"spent while busy");
    }
    function testStaleDraftCannotFundAfterHeadAdvances() public {
        uint256 id=ledger.propose(0,bytes32(0),BODY);_success(initialRequest);
        vm.expectRevert(StepsBranch.StaleAnchor.selector);ledger.fundWithPayment(id,BODY,PRICE);
    }
    function testUnknownAnchorAndUnknownBranchRejected() public {
        vm.expectRevert(StepsBranch.StaleAnchor.selector);ledger.propose(0,keccak256("unknown"),BODY);
        vm.expectRevert(StepsBranch.UnknownBranch.selector);ledger.propose(99,bytes32(0),BODY);
    }
    function testBodyCannotChangeAtFunding() public {
        uint64 branch=ledger.forkFromOrigin();uint256 id=ledger.propose(branch,bytes32(0),BODY);
        vm.expectRevert(StepsBranch.BodyMismatch.selector);ledger.fundWithPayment(id,'{"objective":"other"}',PRICE);
    }
    function testBodySizeBounds() public {
        vm.expectRevert(StepsBranch.InvalidBody.selector);ledger.propose(0,bytes32(0),"");
        bytes memory huge=new bytes(16385);
        vm.expectRevert(StepsBranch.InvalidBody.selector);ledger.propose(0,bytes32(0),huge);
    }
    function testForkDoesNotMoveSourceHeadOrCreateSuccessfulCheckpoint() public {
        _success(initialRequest);bytes32 head=_head(0);bytes32 pending=_fund(0,head);
        vm.prank(address(0xBEEF));uint64 child=ledger.fork(0);
        require(_head(0)==head && _head(child)==head && ledger.count()==1,"fork changed source");
        _success(pending);require(ledger.checkpoint(1).parent==head && _head(child)==head,"pending reparented");
    }
    function testParallelForksCompleteInReverseOrderWithSeparateHeads() public {
        _success(initialRequest);bytes32 head=_head(0);
        uint64 a=ledger.fork(0);uint64 b=ledger.fork(0);
        bytes32 ra=_fund(a,head);bytes32 rb=_fund(b,head);
        _success(rb);_success(ra);
        require(_head(0)==head,"source moved");
        require(ledger.checkpoint(1).parent==head && ledger.checkpoint(2).parent==head,"sibling parent");
        require(ledger.checkpoint(1).branchId==b && ledger.checkpoint(2).branchId==a,"wrong branch");
        require(_head(a)!=_head(b),"branch domain missing");
    }
    function testHistoricalForkKeepsSourceRevision() public {
        _success(initialRequest);bytes32 first=_head(0);_success(_fund(0,first));
        uint64 child=ledger.fork(0);(,uint64 revision,,)=ledger.branches(child);
        require(revision==1 && _head(child)==first,"historical fork");
        _success(_fund(child,first));require(ledger.checkpoint(2).revision==2,"child revision");
    }
    function testReferenceForkNeedsNoRecorderOrFiles() public {
        _success(initialRequest);vm.prank(address(0xCAFE));uint64 child=ledger.fork(0);
        require(child==1 && ledger.branchCount()==2,"permissionless fork");
    }
    function testSnapshotForkVerifiesExactResultBytes() public {
        _success(initialRequest);uint64 child=ledger.forkWithSnapshot(0,RESULT);
        require(_head(child)==_head(0) && ledger.count()==1,"snapshot fork");
        vm.expectRevert(StepsBranch.SnapshotMismatch.selector);ledger.forkWithSnapshot(0,'{"files":["invented"]}');
    }
    function testSnapshotCapDoesNotRestrictReferenceFork() public {
        _success(initialRequest);bytes memory large=new bytes(4097);
        vm.expectRevert(StepsBranch.SnapshotTooLarge.selector);ledger.forkWithSnapshot(0,large);
        require(ledger.fork(0)==1,"reference fallback");
    }
    function testPendingOriginCanBeForkedWithoutFakeSettlement() public {
        uint64 child=ledger.forkFromOrigin();_success(_fund(child,bytes32(0)));
        require(_status(0)==StepsBranch.Status.Pending && _pending(0)==1 && _head(0)==0,"pending was changed");
        require(ledger.checkpoint(0).branchId==child,"new origin branch");
    }
    function testPriceChangeCannotExceedFunderLimit() public {
        uint64 b=ledger.forkFromOrigin();uint256 id=ledger.propose(b,bytes32(0),BODY);
        ledger.setPrice(PRICE*2);uint256 balance=token.balanceOf(address(this));
        vm.expectRevert(StepsBranch.PriceAboveLimit.selector);ledger.fundWithPayment(id,BODY,PRICE);
        require(token.balanceOf(address(this))==balance && _status(id)==StepsBranch.Status.Draft,"price slippage");
    }
    function testIntakeRejectionRollsBackPaymentAndBranchReservation() public {
        uint64 b=ledger.forkFromOrigin();uint256 id=ledger.propose(b,bytes32(0),BODY);uint256 balance=token.balanceOf(address(this));
        intake.setReject(true);vm.expectRevert();ledger.fundWithPayment(id,BODY,PRICE);
        require(token.balanceOf(address(this))==balance && _status(id)==StepsBranch.Status.Draft && _pending(b)==0,"rollback");
    }
    function testZeroAndDuplicateRequestIdsRollBack() public {
        uint64 b=ledger.forkFromOrigin();uint256 id=ledger.propose(b,bytes32(0),BODY);uint256 balance=token.balanceOf(address(this));
        intake.setBadId(1);vm.expectRevert(StepsBranch.InvalidRequestId.selector);ledger.fundWithPayment(id,BODY,PRICE);
        intake.setBadId(2);vm.expectRevert(StepsBranch.InvalidRequestId.selector);ledger.fundWithPayment(id,BODY,PRICE);
        require(token.balanceOf(address(this))==balance && _pending(b)==0,"bad id rollback");
    }
    function testFalseTokenReturnDoesNotCreatePaidState() public {
        FalseToken falseToken=new FalseToken();StepsBranch b=new StepsBranch(IIntake(address(intake)),address(falseToken),PRICE,address(this));
        b.propose(0,bytes32(0),BODY);vm.expectRevert(StepsBranch.TokenCallFailed.selector);b.fundWithPayment(0,BODY,PRICE);
        (,,StepsBranch.Status status,,,,,,,)=b.proposals(0);require(status==StepsBranch.Status.Draft,"false token");
    }
    function testFalseApprovalRollsBackTokenTransfer() public {
        FalseApprovalToken bad=new FalseApprovalToken();StepsBranch b=new StepsBranch(IIntake(address(intake)),address(bad),PRICE,address(this));
        bad.mint(address(this),PRICE);b.propose(0,bytes32(0),BODY);
        vm.expectRevert(StepsBranch.TokenCallFailed.selector);b.fundWithPayment(0,BODY,PRICE);
        require(bad.balanceOf(address(this))==PRICE && bad.balanceOf(address(b))==0,"approval rollback");
    }
    function testTokenCannotReenterBranchMutation() public {
        ReentrantToken t=new ReentrantToken();StepsBranch b=new StepsBranch(IIntake(address(intake)),address(t),PRICE,address(this));
        t.setup(address(b));t.mint(address(this),PRICE);t.approve(address(b),PRICE);b.propose(0,bytes32(0),BODY);
        b.fundWithPayment(0,BODY,PRICE);require(!t.reentered() && b.branchCount()==1,"reentrancy");
    }
    function testOwnershipUsesTwoStepsAndCannotChangeLineage() public {
        ledger.transferOwner(address(0xBEEF));require(ledger.owner()==address(this),"premature handover");
        vm.expectRevert(StepsBranch.NotPendingOwner.selector);ledger.acceptOwner();
        vm.prank(address(0xBEEF));ledger.acceptOwner();
        vm.expectRevert(StepsBranch.NotOwner.selector);ledger.setPrice(1 ether);
        require(ledger.owner()==address(0xBEEF),"handover");
    }
    function testFuzzSiblingCompletionOrder(uint8 rawCount, uint256 order) public {
        uint256 n=uint256(rawCount)%8+1;_success(initialRequest);bytes32 head=_head(0);
        bytes32[] memory req=new bytes32[](n);uint64[] memory ids=new uint64[](n);
        for(uint256 i;i<n;i++) { ids[i]=ledger.fork(0);req[i]=_fund(ids[i],head); }
        uint256 offset=order%n;
        for(uint256 i;i<n;i++) { uint256 j=(i+offset)%n;_success(req[j]);StepsBranch.CheckpointView memory c=ledger.checkpoint(i+1);require(c.branchId==ids[j] && c.parent==head && c.revision==2,"sibling isolation"); }
        require(_head(0)==head && ledger.count()==n+1,"source invariant");
    }

    function _expire(uint256 id) internal {
        (,,,,,,,,,uint64 fundedAt)=ledger.proposals(id);
        vm.warp(uint256(fundedAt)+ledger.PENDING_TIMEOUT());
        vm.prank(address(0xBEEF));ledger.expirePending(id);
    }
    function _assertLateSuccess(uint256 id,bytes memory result,string memory uri) internal view {
        (bool received,uint8 status,bytes32 hash,bytes32 uriHash,bytes32 reason)=ledger.lateReceiptOf(id);
        require(received && status==0 && hash==keccak256(result) && uriHash==keccak256(bytes(uri)) && reason==0,"late success");
        require(_status(id)==StepsBranch.Status.Expired,"expiry overwritten");
    }
    function testExpiryBoundaryAndPermissionlessRelease() public {
        (,,,,,,,,,uint64 fundedAt)=ledger.proposals(0);
        vm.warp(uint256(fundedAt)+ledger.PENDING_TIMEOUT()-1);
        vm.expectRevert(StepsBranch.TooEarly.selector);ledger.expirePending(0);
        vm.recordLogs();_expire(0);Vm.Log[] memory logs=vm.getRecordedLogs();
        require(_status(0)==StepsBranch.Status.Expired && _pending(0)==0 && _head(0)==0 && ledger.count()==0,"expiry state");
        (,,,,,,,,bytes32 reason,)=ledger.proposals(0);require(reason==0,"invented upstream failure");
        require(token.balanceOf(address(intake))==PRICE,"invented refund");
        require(logs.length==1 && logs[0].topics[0]==keccak256("PendingExpired(uint256,uint64,address)"),"expiry event");
        vm.expectRevert(StepsBranch.NotPending.selector);ledger.expirePending(0);
    }
    function testExpiryRejectsUnknownDraftAndSettled() public {
        vm.expectRevert(StepsBranch.UnknownProposal.selector);ledger.expirePending(99);
        uint256 draft=ledger.propose(0,bytes32(0),BODY);
        vm.expectRevert(StepsBranch.NotPending.selector);ledger.expirePending(draft);
        _success(initialRequest);
        vm.warp(block.timestamp+8 days);
        vm.expectRevert(StepsBranch.NotPending.selector);ledger.expirePending(0);
    }
    function testDeadlineAloneDoesNotExpireOrDiscardSuccess() public {
        vm.warp(block.timestamp+8 days);_success(initialRequest);
        require(_status(0)==StepsBranch.Status.Succeeded && ledger.count()==1,"automatic expiry");
        (bool received,,,,)=ledger.lateReceiptOf(0);require(!received,"normal success archived as late");
    }
    function testLateSuccessArchivedWithoutCheckpointOrHeadChange() public {
        _expire(0);_success(initialRequest);_assertLateSuccess(0,RESULT,URI);
        require(ledger.count()==0 && _head(0)==0 && _pending(0)==0,"late result moved branch");
    }
    function testLateSuccessCannotClearNewPendingRequest() public {
        _expire(0);bytes32 newer=_fund(0,bytes32(0));
        _success(initialRequest);_assertLateSuccess(0,RESULT,URI);
        require(_pending(0)==2 && _status(1)==StepsBranch.Status.Pending && ledger.count()==0,"new request corrupted");
        _success(newer);require(ledger.checkpoint(0).requestId==newer && _status(0)==StepsBranch.Status.Expired,"wrong checkpoint");
    }
    function testLateSuccessCannotChangeAdvancedHeadOrAnotherPending() public {
        _expire(0);_success(_fund(0,bytes32(0)));bytes32 head=_head(0);
        bytes32 pending=_fund(0,head);_success(initialRequest);
        require(_head(0)==head && _pending(0)==3 && ledger.count()==1,"advanced branch overwritten");
        _success(pending);require(ledger.checkpoint(1).parent==head && ledger.count()==2,"continuation corrupted");
    }
    function testLateRefusalArchivedWithoutChangingExpiredStatus() public {
        _expire(0);require(intake.fail(initialRequest,1,"refused"),"late refusal failed");
        (bool received,uint8 status,bytes32 hash,bytes32 uriHash,bytes32 reason)=ledger.lateReceiptOf(0);
        require(received && status==1 && hash==0 && uriHash==0 && reason==bytes32("refused"),"late refusal receipt");
        require(_status(0)==StepsBranch.Status.Expired && ledger.count()==0,"late refusal reclassified expiry");
    }
    function testLateFailureCannotClearNewPendingOrOverwriteReason() public {
        _expire(0);bytes32 newer=_fund(0,bytes32(0));
        require(intake.fail(initialRequest,2,"no_result"),"late failure failed");
        (bool received,uint8 status,,,bytes32 reason)=ledger.lateReceiptOf(0);
        require(received && status==2 && reason==bytes32("no_result") && _pending(0)==2,"late failure receipt");
        (,,,,,,,,bytes32 localReason,)=ledger.proposals(0);require(localReason==0,"local expiry became failure");
        _success(newer);
    }
    function testDuplicateOrConflictingLateOutcomesCannotOverwrite() public {
        _expire(0);_success(initialRequest);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onResult(initialRequest,keccak256("other"),"other");
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onFailure(initialRequest,2,"other",0,0,"");
        _assertLateSuccess(0,RESULT,URI);
    }
    function testLateFailureCannotBeReplacedBySuccess() public {
        _expire(0);require(intake.fail(initialRequest,2,"failed"),"failure callback");
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onResult(initialRequest,keccak256(RESULT),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.AlreadySettled.selector);ledger.onFailure(initialRequest,1,"other",0,0,"");
    }
    function testInvalidAndUnauthorizedLateCallbacksLeaveArchiveEmpty() public {
        _expire(0);
        vm.expectRevert(StepsBranch.NotIntake.selector);ledger.onResult(initialRequest,keccak256(RESULT),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.UnknownRequest.selector);ledger.onResult(keccak256("foreign request"),keccak256(RESULT),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.InvalidRequestId.selector);ledger.onResult(initialRequest,bytes32(0),URI);
        vm.prank(address(intake));vm.expectRevert(StepsBranch.InvalidFailureStatus.selector);ledger.onFailure(initialRequest,3,"invalid",0,0,"");
        (bool received,,,,)=ledger.lateReceiptOf(0);require(!received,"invalid archive");_success(initialRequest);
    }
    function testLargeLateUriOmittedButCommittedUnderStipend() public {
        _expire(0);bytes memory uri=new bytes(16384);vm.recordLogs();
        require(intake.deliver(initialRequest,keccak256(RESULT),string(uri)),"late long callback");
        _assertLateSuccess(0,RESULT,string(uri));Vm.Log[] memory logs=vm.getRecordedLogs();
        bool omitted;bool recorded;
        for(uint256 i;i<logs.length;i++) {
            if(logs[i].emitter!=address(ledger)) continue;
            if(logs[i].topics[0]==keccak256("UriOmitted(bytes32)")) omitted=true;
            if(logs[i].topics[0]==keccak256("LateResultRecorded(uint256,uint64,bytes32,bytes32,bytes32,string)")) {
                (bytes32 hash,bytes32 uh,string memory value)=abi.decode(logs[i].data,(bytes32,bytes32,string));
                recorded=hash==keccak256(RESULT) && uh==keccak256(uri) && bytes(value).length==0;
            }
            require(logs[i].topics[0]!=keccak256("CheckpointRecorded(uint256,uint64,uint256,bytes32,bytes32,bytes32,bytes32,string)"),"fake checkpoint event");
        }
        require(omitted && recorded,"late URI evidence missing");
    }
    function testMaximumLateEventUriFitsStipend() public {
        _expire(0);bytes memory uri=new bytes(2048);
        require(intake.deliver(initialRequest,keccak256(RESULT),string(uri)),"late max callback");
        _assertLateSuccess(0,RESULT,string(uri));
    }
    function testMaximumSnapshotIsPersistedAndReferenceRemainsEmpty() public {
        bytes memory data=new bytes(4096);data[0]=0x61;data[4095]=0x7a;
        require(intake.deliver(initialRequest,keccak256(data),URI),"snapshot result");
        uint64 child=ledger.forkWithSnapshot(0,data);
        require(keccak256(ledger.snapshotOf(child))==keccak256(data),"snapshot lost");
        uint64 ref=ledger.fork(0);require(ledger.snapshotOf(ref).length==0,"reference stored snapshot");
        vm.expectRevert(StepsBranch.UnknownBranch.selector);ledger.snapshotOf(99);
    }
    function testExpiredOldParentCannotAffectIndependentFork() public {
        _success(initialRequest);bytes32 head=_head(0);
        bytes32 silent=_fund(0,head);uint64 child=ledger.fork(0);bytes32 childRequest=_fund(child,head);
        _expire(1);_success(silent);
        require(_pending(child)==3 && _head(child)==head && _head(0)==head && ledger.count()==1,"fork affected");
        _success(childRequest);require(ledger.checkpoint(1).parent==head,"fork parent corrupted");
    }

    function testFactoryDeploymentAssignsExplicitOwner() public {
        FactoryStyleDeployer deployer=new FactoryStyleDeployer();
        StepsBranch b=deployer.deploy(IIntake(address(intake)),address(token),PRICE,address(this));
        require(b.owner()==address(this) && b.owner()!=address(deployer),"factory owns contract");
        b.setPrice(PRICE+1);require(b.price()==PRICE+1,"owner cannot manage price");
        vm.prank(address(deployer));vm.expectRevert(StepsBranch.NotOwner.selector);b.setPrice(PRICE);
    }
    function testConstructorRehearsesWithStaticMainnetBindingsOnEmptyChain() public {
        address intakeAddress=address(bytes20(hex"a43e6f75ee006411f79ac1c84120606c2330de82"));
        address tokenAddress=address(bytes20(hex"d34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7"));
        StepsBranch b=new StepsBranch(IIntake(intakeAddress),tokenAddress,PRICE,address(this));
        require(address(b.intake())==intakeAddress && b.asset()==tokenAddress && b.price()==PRICE && b.owner()==address(this),"static bindings");
    }
    function testZeroInitialOwnerRejected() public {
        vm.expectRevert(StepsBranch.InvalidConfiguration.selector);
        new StepsBranch(IIntake(address(intake)),address(token),PRICE,address(0));
    }
}

contract FactoryStyleDeployer {
    function deploy(IIntake intake,address asset,uint256 price,address owner) external returns(StepsBranch) {
        return new StepsBranch(intake,asset,price,owner);
    }
}
