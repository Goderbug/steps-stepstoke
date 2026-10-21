// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {RelayVerifier} from "src/RelayVerifier.sol";
import {RelayEncoder} from "src/RelayEncoder.sol";

import {SpecSetup, SpecData as D} from "./SpecSupport.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayFactory} from "src/RelayFactory.sol";

contract ContinuationSpecTest is SpecSetup {
    function test_fiveRootRoundsTwoSponsorsHistoricalForkAndTwoChildRounds() public {
        T.Asset[] memory docs = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 30),
            empty(),
            "root-doc-1",
            "root-project",
            D.document(),
            ALICE
        );
        T.Asset[] memory firstHtml = accept(
            root, proposal(root, T.Profile.HTMLCreate, 10), docs, "root-html-2", "root-project", D.html(), BOB
        );
        bytes32 historicalAnchor = root.anchor();
        T.Checkpoint memory historical = root.checkpoint(2);
        T.Asset[] memory withImage = accept(
            root,
            proposal(root, T.Profile.ImageCreate, 20),
            firstHtml,
            "root-image-3",
            "root-project",
            D.png(),
            ALICE
        );
        T.Proposal memory update = proposal(root, T.Profile.HTMLUpdate, 10);
        update.inputs = new bytes32[](2);
        update.inputs[0] = bytes32(uint256(10));
        update.inputs[1] = bytes32(uint256(20));
        uint256 selected = root.propose(update, withImage);
        (bytes32 action, bytes memory body) = root.bodyOf(selected, withImage);
        assertEq(action, CONTINUE);
        assertTrue(contains(body, '"parentJobId":"root-image-3"'));
        assertFalse(contains(body, '"parentJobId":"root-html-2"'));
        assertTrue(contains(body, inputJSON(firstHtml[0], 0)));
        assertTrue(contains(body, inputJSON(withImage[1], 1)));
        assertFalse(contains(body, bytes(D.hex32(docs[0].fileHash))));
        assertTrue(contains(body, '"skill":"build-website"'));
        assertTrue(contains(body, ".imd/reads/artifacts/<as>"));
        assertTrue(contains(body, '"github":true,"ipfs":false'));
        assertFalse(contains(body, '"repoUrl"'));
        assertFalse(contains(body, '"baseCommit"'));
        assertFalse(contains(body, '"projectId"'));
        bytes memory raw = D.manifest(update, "root-html-4", "root-project", D.illustratedHtml());
        bytes32 request = pay(root, selected, withImage, BOB);
        assertEq(intake.receipt(request).body, body);
        record(request, raw);
        T.Asset[] memory illustrated =
            D.next(withImage, D.output(update, "root-html-4", D.illustratedHtml(), raw, address(root), 4));
        bindAndCheck(root, raw, withImage, illustrated);
        assertEq(abi.encode(illustrated[1]), abi.encode(withImage[1]));
        assertEq(abi.encode(illustrated[2]), abi.encode(docs[0]));
        assertTrue(contains(D.illustratedHtml(), 'id="keep-html-marker"'));
        assertTrue(
            contains(D.illustratedHtml(), bytes.concat("data:image/png;base64,", bytes(D.pngBase64())))
        );
        T.Asset[] memory fifth = accept(
            root,
            proposal(root, T.Profile.MarkdownUpdate, 30),
            illustrated,
            "root-doc-5",
            "root-project",
            bytes.concat(D.document(), "\nRound five.\n"),
            ALICE
        );
        assertEq(root.revision(), 5);
        assertEq(abi.encode(fifth[0]), abi.encode(illustrated[0]));
        assertEq(abi.encode(fifth[1]), abi.encode(illustrated[1]));
        assertEq(abi.encode(root.checkpoint(2)), abi.encode(historical));

        // Fork a historical two-asset set after the parent has advanced three times.
        uint256 countBefore = intake.count();
        vm.prank(BOB);
        RelayBranch child = factory.fork(address(root), 2, firstHtml, "Keep the early HTML, develop a child.");
        assertEq(intake.count(), countBefore);
        assertEq(child.assetsHash(), historical.assetsHash);
        assertEq(child.goal(), root.goal());
        assertEq(child.direction(), "Keep the early HTML, develop a child.");
        assertEq(child.projectId(), "");
        assertEq(child.latestJobId(), "");
        assertEq(child.proposalCount(), 0);
        assertEq(child.attemptCount(), 0);
        (address parent, uint64 at, bytes32 cp) = child.source();
        assertEq(parent, address(root));
        assertEq(at, 2);
        assertEq(cp, historicalAnchor);
        approveBoth(child);
        T.Proposal memory childUpdate = proposal(child, T.Profile.HTMLUpdate, 10);
        uint256 childId = child.propose(childUpdate, firstHtml);
        (action, body) = child.bodyOf(childId, firstHtml);
        assertEq(action, OPEN);
        assertFalse(contains(body, '"parentJobId"'));
        assertFalse(contains(body, "root-project"));
        assertFalse(contains(body, "root-doc-5"));
        assertTrue(contains(body, inputJSON(firstHtml[0], 0)));
        bytes memory childFile = bytes.concat(D.html(), "\n<!-- child-one -->");
        bytes memory childRaw = D.manifest(childUpdate, "child-html-1", "child-project", childFile);
        request = pay(child, childId, firstHtml, BOB);
        assertEq(intake.receipt(request).payer, address(child));
        record(request, childRaw);
        T.Asset[] memory childAssets =
            D.next(firstHtml, D.output(childUpdate, "child-html-1", childFile, childRaw, address(child), 1));
        bindAndCheck(child, childRaw, firstHtml, childAssets);
        assertEq(abi.encode(childAssets[1]), abi.encode(docs[0]));
        assertEq(childAssets[1].producer, address(root));

        // Actually buy, callback and bind the child's continuation, not merely preview it.
        T.Proposal memory childDoc = proposal(child, T.Profile.MarkdownUpdate, 30);
        childId = child.propose(childDoc, childAssets);
        (action, body) = child.bodyOf(childId, childAssets);
        assertEq(action, CONTINUE);
        assertTrue(contains(body, '"parentJobId":"child-html-1"'));
        assertFalse(contains(body, "root-doc-5"));
        childRaw = D.manifest(childDoc, "child-doc-2", "child-project", D.document());
        request = pay(child, childId, childAssets, ALICE);
        assertEq(intake.receipt(request).body, body);
        assertEq(intake.receipt(request).payer, address(child));
        record(request, childRaw);
        T.Asset[] memory childFinal =
            D.next(childAssets, D.output(childDoc, "child-doc-2", D.document(), childRaw, address(child), 2));
        bindAndCheck(child, childRaw, childAssets, childFinal);
        assertEq(child.revision(), 2);
        assertEq(child.projectId(), "child-project");
        assertEq(root.revision(), 5);
        assertEq(root.assetsHash(), keccak256(abi.encode(fifth)));
        assertEq(abi.encode(root.checkpoint(2)), abi.encode(historical));
        assertEq(token.balanceOf(ALICE), INITIAL - 4 * FEE);
        assertEq(token.balanceOf(BOB), INITIAL - 3 * FEE);
        assertEq(token.balanceOf(address(child)), 0);
        assertEq(token.allowance(address(child), INTAKE), 0);
        assertAccounting(7 * FEE, 0);
    }

    function test_currentProposalsSelectableInEitherOrderAndLosingSponsorPaysNothing() public {
        bytes32 original = root.anchor();
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 5);
        uint256 first = root.propose(p, empty());
        p.text = "Later competing proposal.";
        uint256 second = root.propose(p, empty());
        p.text = "Third independent proposal.";
        uint256 third = root.propose(p, empty());
        assertEq(root.anchor(), original);
        assertEq(root.proposal(first).text, "Preserve existing markers and produce the declared output.");
        assertAccounting(0, 0);
        bytes32 request = pay(root, second, empty(), BOB);
        uint256 transfers = token.transfers();
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.sponsor(first, FEE, empty());
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.sponsor(second, FEE, empty());
        // A proposal arriving during execution cannot rewrite the purchased body.
        p.text = "Arrived after purchase.";
        root.propose(p, empty());
        assertEq(root.activeProposal(), second);
        assertEq(token.transfers(), transfers);
        assertEq(intake.receipt(request).body, preview(second, empty()));
        T.Proposal memory purchased = root.proposal(second);
        bytes memory raw = D.manifest(purchased, "chosen-job", "chosen-project", D.document());
        record(request, raw);
        T.Asset[] memory assets =
            D.next(empty(), D.output(purchased, "chosen-job", D.document(), raw, address(root), 1));
        bindAndCheck(root, raw, empty(), assets);
        for (uint256 i = first; i <= third; ++i) {
            vm.prank(ALICE);
            vm.expectRevert(RelayBranch.Stale.selector);
            root.sponsor(i, FEE, assets);
        }
        assertEq(token.transfers(), transfers);
        assertAccounting(FEE, 0);

        // An earlier proposal also remains selectable after a newer insertion.
        uint256 early = root.propose(proposal(root, T.Profile.MarkdownUpdate, 5), assets);
        root.propose(proposal(root, T.Profile.ImageCreate, 9), assets);
        pay(root, early, assets, ALICE);
        assertEq(root.activeProposal(), early);
        assertAccounting(2 * FEE, 0);
    }

    function test_everyWitnessFieldAuthenticatedForSponsorBindAndHistoricalFork() public {
        T.Asset[] memory old = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 1),
            empty(),
            "witness-job-1",
            "witness-project",
            D.document(),
            ALICE
        );
        T.Proposal memory p = proposal(root, T.Profile.MarkdownUpdate, 1);
        uint256 id = root.propose(p, old);
        bytes memory raw = D.manifest(p, "witness-job-2", "witness-project", D.document());
        bytes32 digest = root.anchor();
        uint256 transfers = token.transfers();
        for (uint8 field; field < 12; ++field) {
            T.Asset[] memory forged = abi.decode(abi.encode(old), (T.Asset[]));
            mutate(forged[0], field);
            vm.prank(BOB);
            vm.expectRevert(RelayBranch.InvalidWitness.selector);
            root.sponsor(id, FEE, forged);
            vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
            factory.fork(address(root), 1, forged, "Forged history.");
        }
        assertEq(token.transfers(), transfers);
        record(pay(root, id, old, BOB), raw);
        for (uint8 field; field < 12; ++field) {
            T.Asset[] memory forged = abi.decode(abi.encode(old), (T.Asset[]));
            mutate(forged[0], field);
            vm.expectRevert(RelayBranch.InvalidWitness.selector);
            root.bind(raw, forged);
            assertEq(root.anchor(), digest);
            assertEq(root.attempt(2).outcome, keccak256(raw));
            assertEq(uint256(root.phase()), uint256(T.Phase.ResultRecorded));
        }
        T.Asset[] memory next = D.next(old, D.output(p, "witness-job-2", D.document(), raw, address(root), 2));
        bindAndCheck(root, raw, old, next);
        assertAccounting(2 * FEE, 0);
    }

    function test_foreignFactoryAndUnregisteredLookalikeCannotForgeHistoricalFork() public {
        T.Asset[] memory assets = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 1),
            empty(),
            "fork-job",
            "fork-project",
            D.document(),
            ALICE
        );
        RelayFactory other = new RelayFactory(new RelayEncoder(), new RelayVerifier());
        vm.expectRevert(RelayFactory.InvalidParent.selector);
        other.fork(address(root), 1, assets, "Cross-factory forgery.");
        RelayBranch impostor = other.createProject(root.goal());
        vm.expectRevert(RelayFactory.InvalidParent.selector);
        factory.fork(address(impostor), 1, assets, "Unregistered parent.");
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(root), type(uint64).max, assets, "Nonexistent future.");
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(root), 0, empty(), "Unaccepted initial state.");
        assertEq(factory.branchCount(), 1);
        assertAccounting(FEE, 0);
    }

    function test_checkpointPreimageBindsChainFactoryBranchPolicyRevisionAndSource() public {
        T.Asset[] memory assets = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 1),
            empty(),
            "domain-job",
            "domain-project",
            D.document(),
            ALICE
        );
        RelayBranch child = factory.fork(address(root), 1, assets, "A fixed direction.");
        assertCheckpoint(root, 1);
        assertCheckpoint(child, 0);
        assertTrue(child.anchor() != root.anchor());
        RelayBranch sibling = factory.fork(address(root), 1, assets, "A fixed direction.");
        assertTrue(sibling.anchor() != child.anchor());
        assertEq(sibling.assetsHash(), child.assetsHash());
    }

    function assertCheckpoint(RelayBranch branch, uint64 revision) private view {
        T.Checkpoint memory cp = branch.checkpoint(revision);
        (address parent, uint64 at, bytes32 digest) = branch.source();
        assertEq(
            cp.digest,
            keccak256(
                abi.encode(
                    block.chainid,
                    address(factory),
                    address(branch),
                    keccak256("STEPS/RELEASE-CANDIDATE-V1/fixed-profiles/artifacts/unpublished"),
                    address(factory.encoder()),
                    address(factory.verifier()),
                    keccak256(bytes(branch.goal())),
                    keccak256(bytes(branch.direction())),
                    T.Source(parent, at, digest),
                    revision,
                    cp.assetsHash,
                    cp.resultHash,
                    cp.jobHash,
                    cp.projectHash
                )
            )
        );
    }

    function preview(uint256 id, T.Asset[] memory assets) private view returns (bytes memory body) {
        (, body) = root.bodyOf(id, assets);
    }

    function inputJSON(T.Asset memory a, uint256 aliasIndex) private pure returns (bytes memory) {
        return bytes.concat(
            '{"name":"',
            bytes(a.name),
            '","path":"',
            bytes(a.path),
            '","hash":"',
            bytes(D.hex32(a.fileHash)),
            '","mediaType":"',
            bytes(a.mediaType),
            '","bytes":',
            bytes(D.decimal(a.size)),
            ',"submissionHash":"',
            bytes(D.hex32(a.submissionHash)),
            '","as":"asset-',
            bytes(D.decimal(aliasIndex)),
            '"}'
        );
    }

    function mutate(T.Asset memory a, uint8 field) private pure {
        if (field == 0) a.key = bytes32(uint256(2));
        if (field == 1) a.kind = T.Kind.HTML;
        if (field == 2) a.name = "other-name";
        if (field == 3) a.path = "other/path.md";
        if (field == 4) a.fileHash = sha256("forged content");
        if (field == 5) a.mediaType = "text/plain";
        if (field == 6) ++a.size;
        if (field == 7) a.submissionHash = sha256("forged submission");
        if (field == 8) a.producer = BOB;
        if (field == 9) a.jobId = "other-job";
        if (field == 10) a.resultHash = keccak256("forged manifest");
        if (field == 11) ++a.revision;
    }
}
