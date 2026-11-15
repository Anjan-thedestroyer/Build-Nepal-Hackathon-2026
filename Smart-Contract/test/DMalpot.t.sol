// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {DMalpot} from "../src/DMalpot.sol";

contract DMalpotTest is Test {
    DMalpot public dmalpot;

    address public admin = address(0xAD);
    address public officer = address(0x0F);
    address public civilian = address(0xCC);

    string constant CITIZEN_A = "27-01-79-00001";
    string constant CITIZEN_B = "27-01-79-00002";
    string constant CITIZEN_C = "27-01-79-00003";

    function setUp() public {
        vm.prank(admin);
        dmalpot = new DMalpot(admin);

        vm.prank(admin);
        dmalpot.setOfficerStatus(officer, true);
    }

    function _sampleCadastral(uint256 kitta) internal pure returns (DMalpot.CadastralAddress memory) {
        return DMalpot.CadastralAddress({
            district: "Kathmandu", localGovernment: "Kathmandu Metropolitan", wardNumber: 3, kittaNumber: kitta
        });
    }

    function _sampleCoordinates() internal pure returns (int32[] memory lats, int32[] memory longs) {
        lats = new int32[](3);
        lats[0] = 27717200;
        lats[1] = 27718000;
        lats[2] = 27717500;

        longs = new int32[](3);
        longs[0] = 85324000;
        longs[1] = 85325000;
        longs[2] = 85326000;
    }

    // -------------------------------------------------------------
    // Initialization & Access Control Tests
    // -------------------------------------------------------------

    function test_InitialState() public view {
        assertEq(dmalpot.owner(), admin);
        assertTrue(dmalpot.isOfficer(admin));
        assertTrue(dmalpot.isOfficer(officer));
        assertFalse(dmalpot.isOfficer(civilian));
    }

    function test_SetOfficerStatus() public {
        address newOfficer = address(0x123);
        vm.prank(admin);
        dmalpot.setOfficerStatus(newOfficer, true);
        assertTrue(dmalpot.isOfficer(newOfficer));

        vm.prank(admin);
        dmalpot.setOfficerStatus(newOfficer, false);
        assertFalse(dmalpot.isOfficer(newOfficer));
    }

    function test_Revert_SetOfficerStatus_Unauthorized() public {
        vm.prank(civilian);
        vm.expectRevert();
        dmalpot.setOfficerStatus(civilian, true);
    }

    function test_Revert_SetOfficerStatus_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(DMalpot.InvalidAddress.selector);
        dmalpot.setOfficerStatus(address(0), true);
    }

    // -------------------------------------------------------------
    // Land Registration Tests
    // -------------------------------------------------------------

    function test_AddLand_Success() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        bytes32 docHash = keccak256("lalpurja-scanned-pdf-hash");

        vm.prank(officer);
        dmalpot.addLand(
            1,
            "LAL-001-KTM",
            docHash,
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500, // 500 sq meters
            owners,
            lats,
            longs
        );

        (
            uint256 landId,
            string memory lalpurjaNo,
            bytes32 storedDocHash,
            DMalpot.CadastralAddress memory cadastral,
            DMalpot.LandCategory category,
            uint256 area,
            bool isFrozen,
            string[] memory ownerList,
        ) = dmalpot.getLand(1);

        assertEq(landId, 1);
        assertEq(lalpurjaNo, "LAL-001-KTM");
        assertEq(storedDocHash, docHash);
        assertEq(cadastral.district, "Kathmandu");
        assertEq(cadastral.wardNumber, 3);
        assertEq(cadastral.kittaNumber, 101);
        assertTrue(category == DMalpot.LandCategory.Residential);
        assertEq(area, 500);
        assertFalse(isFrozen);
        assertEq(ownerList.length, 1);
        assertEq(ownerList[0], CITIZEN_A);

        // Verify indexing
        uint256[] memory citizenLands = dmalpot.getLandsByCitizen(CITIZEN_A);
        assertEq(citizenLands.length, 1);
        assertEq(citizenLands[0], 1);

        uint256[] memory wardLands = dmalpot.getLandsByWard("Kathmandu", "Kathmandu Metropolitan", 3);
        assertEq(wardLands.length, 1);
        assertEq(wardLands[0], 1);

        assertTrue(dmalpot.verifyDocumentHash(1, docHash));
        assertFalse(dmalpot.verifyDocumentHash(1, keccak256("wrong-hash")));
    }

    function test_Revert_AddLand_NonOfficer() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.prank(civilian);
        vm.expectRevert(DMalpot.NotAuthorizedOfficer.selector);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
    }

    function test_Revert_AddLand_DuplicateId() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        vm.expectRevert(DMalpot.LandAlreadyRegistered.selector);
        dmalpot.addLand(
            1, // duplicate id
            "LAL-002",
            keccak256("doc2"),
            _sampleCadastral(102),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
        vm.stopPrank();
    }

    function test_Revert_AddLand_DuplicateCadastral() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        vm.expectRevert(DMalpot.KittaAlreadyRegistered.selector);
        dmalpot.addLand(
            2,
            "LAL-002",
            keccak256("doc2"),
            _sampleCadastral(101), // duplicate kitta in same ward/district
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
        vm.stopPrank();
    }

    function test_Revert_AddLand_DuplicateDocumentHash() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;
        bytes32 docHash = keccak256("same-pdf");

        vm.startPrank(officer);
        dmalpot.addLand(
            1, "LAL-001", docHash, _sampleCadastral(101), DMalpot.LandCategory.Residential, 500, owners, lats, longs
        );

        vm.expectRevert(DMalpot.DocumentHashExists.selector);
        dmalpot.addLand(
            2,
            "LAL-002",
            docHash, // duplicate doc hash
            _sampleCadastral(102),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
        vm.stopPrank();
    }

    function test_Revert_AddLand_InvalidPolygon() public {
        int32[] memory lats = new int32[](2);
        int32[] memory longs = new int32[](2);
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.prank(officer);
        vm.expectRevert(DMalpot.InvalidPolygonCoordinates.selector);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
    }

    function test_NoHashCollision_CadastralKeys() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        // With abi.encodePacked, ("Kathmandu", "Metropolitan", 3, 101) and ("KathmanduMetropolitan", "", 3, 101) collide!
        // With abi.encode, both can register without false collision rejection:
        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            DMalpot.CadastralAddress("Kathmandu", "Metropolitan", 3, 101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        dmalpot.addLand(
            2,
            "LAL-002",
            keccak256("doc2"),
            DMalpot.CadastralAddress("KathmanduMetropolitan", "", 3, 101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );
        vm.stopPrank();

        (,,,,,,, bool isReg1,) = dmalpot.properties(1);
        (,,,,,,, bool isReg2,) = dmalpot.properties(2);
        assertTrue(isReg1);
        assertTrue(isReg2);
    }

    // -------------------------------------------------------------
    // Land Freeze & Category Update Tests
    // -------------------------------------------------------------

    function test_ToggleLandFreeze() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        dmalpot.toggleLandFreeze(1, true);
        (,,,,,, bool isFrozen1,,) = dmalpot.getLand(1);
        assertTrue(isFrozen1);

        // Attempt transfer while frozen
        vm.expectRevert(DMalpot.PropertyIsFrozen.selector);
        dmalpot.transferLand(1, CITIZEN_A, CITIZEN_B, 1000000);

        // Attempt category update while frozen
        vm.expectRevert(DMalpot.PropertyIsFrozen.selector);
        dmalpot.setLandCategory(1, DMalpot.LandCategory.Commercial);

        dmalpot.toggleLandFreeze(1, false);
        (,,,,,, bool isFrozen2,,) = dmalpot.getLand(1);
        assertFalse(isFrozen2);
        vm.stopPrank();
    }

    function test_SetLandCategory_Success() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        dmalpot.setLandCategory(1, DMalpot.LandCategory.Commercial);
        (,,,, DMalpot.LandCategory newCat,,,,) = dmalpot.getLand(1);
        assertTrue(newCat == DMalpot.LandCategory.Commercial);

        vm.expectRevert(DMalpot.SameCategoryError.selector);
        dmalpot.setLandCategory(1, DMalpot.LandCategory.Commercial);
        vm.stopPrank();
    }

    // -------------------------------------------------------------
    // Land Transfer Tests (Single, Joint, Co-owner Buyout)
    // -------------------------------------------------------------

    function test_TransferLand_SingleOwner() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        dmalpot.transferLand(1, CITIZEN_A, CITIZEN_B, 2500000); // 25 Lakhs NPR
        vm.stopPrank();

        (,,,,,,, string[] memory newOwners,) = dmalpot.getLand(1);
        assertEq(newOwners.length, 1);
        assertEq(newOwners[0], CITIZEN_B);

        assertEq(dmalpot.getLandsByCitizen(CITIZEN_A).length, 0);
        uint256[] memory bLands = dmalpot.getLandsByCitizen(CITIZEN_B);
        assertEq(bLands.length, 1);
        assertEq(bLands[0], 1);
    }

    function test_TransferLand_JointOwnership() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](2);
        owners[0] = CITIZEN_A;
        owners[1] = CITIZEN_B;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        // Citizen A sells their share to Citizen C
        dmalpot.transferLand(1, CITIZEN_A, CITIZEN_C, 1500000);
        vm.stopPrank();

        (,,,,,,, string[] memory newOwners,) = dmalpot.getLand(1);
        assertEq(newOwners.length, 2);
        assertEq(newOwners[0], CITIZEN_C);
        assertEq(newOwners[1], CITIZEN_B);

        assertEq(dmalpot.getLandsByCitizen(CITIZEN_A).length, 0);
        assertEq(dmalpot.getLandsByCitizen(CITIZEN_B).length, 1);
        assertEq(dmalpot.getLandsByCitizen(CITIZEN_C).length, 1);
    }

    function test_TransferLand_CoOwnerBuyout() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](2);
        owners[0] = CITIZEN_A;
        owners[1] = CITIZEN_B;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        // Citizen B buys out Citizen A's share
        dmalpot.transferLand(1, CITIZEN_A, CITIZEN_B, 1500000);
        vm.stopPrank();

        (,,,,,,, string[] memory newOwners,) = dmalpot.getLand(1);
        // Ownership collapses to single owner CITIZEN_B without duplicating CITIZEN_B
        assertEq(newOwners.length, 1);
        assertEq(newOwners[0], CITIZEN_B);

        assertEq(dmalpot.getLandsByCitizen(CITIZEN_A).length, 0);
        // CITIZEN_B still only has 1 record in citizenToLandIds (no duplicate push)
        uint256[] memory bLands = dmalpot.getLandsByCitizen(CITIZEN_B);
        assertEq(bLands.length, 1);
        assertEq(bLands[0], 1);
    }

    function test_Revert_TransferLand_SellerDoesNotOwn() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        vm.expectRevert(DMalpot.SellerDoesNotOwnLand.selector);
        dmalpot.transferLand(1, CITIZEN_B, CITIZEN_C, 1000000);
        vm.stopPrank();
    }

    function test_Revert_TransferLand_SameOwner() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-001",
            keccak256("doc1"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        vm.expectRevert(DMalpot.SameOwnerTransfer.selector);
        dmalpot.transferLand(1, CITIZEN_A, CITIZEN_A, 1000000);
        vm.stopPrank();
    }

    // -------------------------------------------------------------
    // Land Subdivision Tests (Kitta Kaat)
    // -------------------------------------------------------------

    function test_SubdivideLand_KittaKaat() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        // Parent plot: 1000 sq meters
        dmalpot.addLand(
            1,
            "LAL-PARENT-01",
            keccak256("parent-doc"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            1000,
            owners,
            lats,
            longs
        );

        string[] memory childOwners = new string[](1);
        childOwners[0] = CITIZEN_B;

        // Subdivide 400 sq meters into child plot (Kitta 102)
        dmalpot.subdivideLand(
            1, // parentLandId
            2, // childLandId
            "LAL-CHILD-01",
            keccak256("child-doc"),
            102, // new child kitta
            400, // child area
            childOwners,
            lats,
            longs
        );
        vm.stopPrank();

        // Verify parent area reduced from 1000 to 600
        (,,,,, uint256 parentRemainingArea,,,) = dmalpot.getLand(1);
        assertEq(parentRemainingArea, 600);

        // Verify child parcel
        (
            uint256 childId,
            string memory childLalpurja,,
            DMalpot.CadastralAddress memory childCadastral,,
            uint256 childArea,,
            string[] memory childOwnerList,
        ) = dmalpot.getLand(2);

        assertEq(childId, 2);
        assertEq(childLalpurja, "LAL-CHILD-01");
        assertEq(childCadastral.kittaNumber, 102);
        assertEq(childCadastral.district, "Kathmandu");
        assertEq(childArea, 400);
        (,,,,,,,, uint256 parentRefId) = dmalpot.properties(2);
        assertEq(parentRefId, 1);
        assertEq(childOwnerList[0], CITIZEN_B);
    }

    function test_Revert_SubdivideLand_AreaExceedsParent() public {
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.startPrank(officer);
        dmalpot.addLand(
            1,
            "LAL-PARENT-01",
            keccak256("parent-doc"),
            _sampleCadastral(101),
            DMalpot.LandCategory.Residential,
            500,
            owners,
            lats,
            longs
        );

        string[] memory childOwners = new string[](1);
        childOwners[0] = CITIZEN_B;

        vm.expectRevert(DMalpot.InvalidSubdivisionArea.selector);
        dmalpot.subdivideLand(
            1,
            2,
            "LAL-CHILD-01",
            keccak256("child-doc"),
            102,
            500, // equal or greater than parent area
            childOwners,
            lats,
            longs
        );
        vm.stopPrank();
    }

    // -------------------------------------------------------------
    // Fuzz Tests
    // -------------------------------------------------------------

    function testFuzz_VerifyDocumentHash(bytes32 docHash) public {
        vm.assume(docHash != bytes32(0));
        (int32[] memory lats, int32[] memory longs) = _sampleCoordinates();
        string[] memory owners = new string[](1);
        owners[0] = CITIZEN_A;

        vm.prank(officer);
        dmalpot.addLand(
            1, "LAL-FUZZ", docHash, _sampleCadastral(999), DMalpot.LandCategory.Residential, 500, owners, lats, longs
        );

        assertTrue(dmalpot.verifyDocumentHash(1, docHash));
        assertFalse(dmalpot.verifyDocumentHash(1, keccak256(abi.encode(docHash, "different"))));
    }
}
