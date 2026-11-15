// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DMalpot (Digital Malpot)
 * @notice On-chain land registry and property transfer contract for municipal land administration in Nepal.
 * @dev Optimized for gas efficiency, hash collision safety, and operational reliability.
 */
contract DMalpot is Ownable, ReentrancyGuard {
    enum LandCategory {
        Residential,
        Agricultural,
        Commercial,
        Industrial,
        Government
    }

    struct Coordinate {
        int32 latitude;
        int32 longitude;
    }

    struct CadastralAddress {
        string district;
        string localGovernment;
        uint8 wardNumber;
        uint256 kittaNumber;
    }

    struct Property {
        uint256 landId;
        string lalpurjaNo;
        bytes32 documentHash;
        CadastralAddress cadastral;
        LandCategory category;
        uint256 areaInSqMeters;
        bool isFrozen;
        bool isRegistered;
        uint256 parentLandId;
        string[] citizenshipNumbers;
    }

    // Custom Errors (Gas Optimization)
    error NotAuthorizedOfficer();
    error LandDoesNotExist();
    error LandAlreadyRegistered();
    error InvalidAddress();
    error DocumentHashRequired();
    error DocumentHashExists();
    error NoOwnersProvided();
    error LatLongMismatch();
    error InvalidPolygonCoordinates();
    error LalpurjaAlreadyExists();
    error KittaAlreadyRegistered();
    error PropertyIsFrozen();
    error SellerDoesNotOwnLand();
    error SameCategoryError();
    error InvalidBuyer();
    error SameOwnerTransfer();
    error InvalidSubdivisionArea();
    error ZeroAreaNotAllowed();

    // Mappings
    mapping(address => bool) public isOfficer;
    mapping(uint256 => Property) public properties;

    mapping(bytes32 => bool) private cadastralHashes;
    mapping(bytes32 => bool) private lalpurjaHashes;
    mapping(bytes32 => bool) public documentHashes;
    mapping(uint256 => Coordinate[]) private landBoundaries;
    mapping(string => uint256[]) private citizenToLandIds;
    mapping(bytes32 => uint256[]) private wardToLandIds;

    // Events
    event OfficerStatusUpdated(address indexed officer, bool isAuthorized);
    event LandRegistered(
        uint256 indexed landId,
        uint256 indexed kittaNumber,
        string district,
        uint8 wardNumber,
        string lalpurjaNo,
        bytes32 documentHash,
        LandCategory category,
        uint256 ownerCount
    );
    event LandCategoryUpdated(uint256 indexed landId, LandCategory oldCategory, LandCategory newCategory);
    event LandFreezeStatusChanged(uint256 indexed landId, bool isFrozen);
    event PropertyTransferred(
        uint256 indexed landId, string sellerCitizenshipNo, string buyerCitizenshipNo, uint256 price
    );
    event LandSubdivided(
        uint256 indexed parentLandId, uint256 indexed childLandId, uint256 parentRemainingArea, uint256 childArea
    );

    modifier onlyOfficer() {
        if (!isOfficer[msg.sender] && msg.sender != owner()) revert NotAuthorizedOfficer();
        _;
    }

    modifier landExists(uint256 _landId) {
        if (!properties[_landId].isRegistered) revert LandDoesNotExist();
        _;
    }

    constructor(address initialAdmin) Ownable(initialAdmin) {
        if (initialAdmin == address(0)) revert InvalidAddress();
        isOfficer[initialAdmin] = true;
        emit OfficerStatusUpdated(initialAdmin, true);
    }

    function setOfficerStatus(address _officer, bool _status) external onlyOwner {
        if (_officer == address(0)) revert InvalidAddress();
        isOfficer[_officer] = _status;
        emit OfficerStatusUpdated(_officer, _status);
    }

    function addLand(
        uint256 _landId,
        string memory _lalpurjaNo,
        bytes32 _documentHash,
        CadastralAddress memory _cadastral,
        LandCategory _category,
        uint256 _areaInSqMeters,
        string[] memory _citizenshipNumbers,
        int32[] memory _latitudes,
        int32[] memory _longitudes
    ) public nonReentrant onlyOfficer {
        _registerLandCore(
            _landId,
            _lalpurjaNo,
            _documentHash,
            _cadastral,
            _category,
            _areaInSqMeters,
            _citizenshipNumbers,
            _latitudes,
            _longitudes,
            0
        );
    }

    /**
     * @notice Subdivide an existing land plot (Kitta Kaat) into a child parcel.
     * @dev Deducts child area from parent parcel and links child parcel to parentLandId.
     */
    function subdivideLand(
        uint256 _parentLandId,
        uint256 _childLandId,
        string memory _childLalpurjaNo,
        bytes32 _childDocumentHash,
        uint256 _childKittaNumber,
        uint256 _childAreaInSqMeters,
        string[] memory _childCitizenshipNumbers,
        int32[] memory _childLatitudes,
        int32[] memory _childLongitudes
    ) external nonReentrant onlyOfficer landExists(_parentLandId) {
        Property storage parent = properties[_parentLandId];
        if (parent.isFrozen) revert PropertyIsFrozen();
        if (_childAreaInSqMeters == 0) revert ZeroAreaNotAllowed();
        if (_childAreaInSqMeters >= parent.areaInSqMeters) revert InvalidSubdivisionArea();

        parent.areaInSqMeters -= _childAreaInSqMeters;

        CadastralAddress memory childCadastral = CadastralAddress({
            district: parent.cadastral.district,
            localGovernment: parent.cadastral.localGovernment,
            wardNumber: parent.cadastral.wardNumber,
            kittaNumber: _childKittaNumber
        });

        _registerLandCore(
            _childLandId,
            _childLalpurjaNo,
            _childDocumentHash,
            childCadastral,
            parent.category,
            _childAreaInSqMeters,
            _childCitizenshipNumbers,
            _childLatitudes,
            _childLongitudes,
            _parentLandId
        );

        emit LandSubdivided(_parentLandId, _childLandId, parent.areaInSqMeters, _childAreaInSqMeters);
    }

    function _registerLandCore(
        uint256 _landId,
        string memory _lalpurjaNo,
        bytes32 _documentHash,
        CadastralAddress memory _cadastral,
        LandCategory _category,
        uint256 _areaInSqMeters,
        string[] memory _citizenshipNumbers,
        int32[] memory _latitudes,
        int32[] memory _longitudes,
        uint256 _parentLandId
    ) internal {
        if (properties[_landId].isRegistered) revert LandAlreadyRegistered();
        if (_areaInSqMeters == 0) revert ZeroAreaNotAllowed();
        if (_documentHash == bytes32(0)) revert DocumentHashRequired();
        if (documentHashes[_documentHash]) revert DocumentHashExists();
        if (_citizenshipNumbers.length == 0) revert NoOwnersProvided();
        if (_latitudes.length != _longitudes.length) revert LatLongMismatch();
        if (_latitudes.length < 3) revert InvalidPolygonCoordinates();

        bytes32 lalpurjaHashKey = keccak256(bytes(_lalpurjaNo));
        if (lalpurjaHashes[lalpurjaHashKey]) revert LalpurjaAlreadyExists();

        // Use abi.encode instead of abi.encodePacked to prevent dynamic string hash collisions
        bytes32 cadastralHashKey = keccak256(
            abi.encode(_cadastral.district, _cadastral.localGovernment, _cadastral.wardNumber, _cadastral.kittaNumber)
        );
        if (cadastralHashes[cadastralHashKey]) revert KittaAlreadyRegistered();

        Property storage land = properties[_landId];
        land.landId = _landId;
        land.lalpurjaNo = _lalpurjaNo;
        land.documentHash = _documentHash;
        land.cadastral = _cadastral;
        land.category = _category;
        land.areaInSqMeters = _areaInSqMeters;
        land.isFrozen = false;
        land.isRegistered = true;
        land.parentLandId = _parentLandId;
        land.citizenshipNumbers = _citizenshipNumbers;

        lalpurjaHashes[lalpurjaHashKey] = true;
        cadastralHashes[cadastralHashKey] = true;
        documentHashes[_documentHash] = true;

        for (uint256 i = 0; i < _latitudes.length; i++) {
            landBoundaries[_landId].push(Coordinate({latitude: _latitudes[i], longitude: _longitudes[i]}));
        }

        for (uint256 j = 0; j < _citizenshipNumbers.length; j++) {
            citizenToLandIds[_citizenshipNumbers[j]].push(_landId);
        }

        // Use abi.encode to prevent collisions between district and local government strings
        bytes32 wardKey = keccak256(abi.encode(_cadastral.district, _cadastral.localGovernment, _cadastral.wardNumber));
        wardToLandIds[wardKey].push(_landId);

        emit LandRegistered(
            _landId,
            _cadastral.kittaNumber,
            _cadastral.district,
            _cadastral.wardNumber,
            _lalpurjaNo,
            _documentHash,
            _category,
            _citizenshipNumbers.length
        );
    }

    function toggleLandFreeze(uint256 _landId, bool _freeze) external onlyOfficer landExists(_landId) {
        properties[_landId].isFrozen = _freeze;
        emit LandFreezeStatusChanged(_landId, _freeze);
    }

    /**
     * @notice Direct land ownership transfer executed by an authorized Malpot officer.
     * @param _landId The ID of the land parcel being transferred.
     * @param _sellerCitizenshipNo Citizenship number of the current owner selling the plot.
     * @param _buyerCitizenshipNo Citizenship number of the new owner.
     * @param _price The agreed transaction value (for audit logging).
     */
    function transferLand(
        uint256 _landId,
        string memory _sellerCitizenshipNo,
        string memory _buyerCitizenshipNo,
        uint256 _price
    ) external nonReentrant onlyOfficer landExists(_landId) {
        Property storage land = properties[_landId];
        if (land.isFrozen) revert PropertyIsFrozen();
        if (bytes(_buyerCitizenshipNo).length == 0) revert InvalidBuyer();

        bytes32 sellerHash = keccak256(bytes(_sellerCitizenshipNo));
        bytes32 buyerHash = keccak256(bytes(_buyerCitizenshipNo));
        if (sellerHash == buyerHash) revert SameOwnerTransfer();

        // 1. Validate that the seller actually owns this property
        bool isSellerOwner = false;
        bool isBuyerAlreadyOwner = false;
        uint256 sellerIndex = 0;

        uint256 numOwners = land.citizenshipNumbers.length;
        for (uint256 i = 0; i < numOwners; i++) {
            bytes32 currentOwnerHash = keccak256(bytes(land.citizenshipNumbers[i]));
            if (currentOwnerHash == sellerHash) {
                isSellerOwner = true;
                sellerIndex = i;
            } else if (currentOwnerHash == buyerHash) {
                isBuyerAlreadyOwner = true;
            }
        }
        if (!isSellerOwner) revert SellerDoesNotOwnLand();

        // 2. Remove landId from seller's citizenToLandIds index
        uint256[] storage sellerLands = citizenToLandIds[_sellerCitizenshipNo];
        for (uint256 i = 0; i < sellerLands.length; i++) {
            if (sellerLands[i] == _landId) {
                sellerLands[i] = sellerLands[sellerLands.length - 1];
                sellerLands.pop();
                break;
            }
        }

        // 3. Update buyer's citizenToLandIds index if not already recorded
        if (!isBuyerAlreadyOwner) {
            citizenToLandIds[_buyerCitizenshipNo].push(_landId);
        }

        // 4. Update the land's ownership array
        if (isBuyerAlreadyOwner) {
            // Buyer is already a co-owner purchasing seller's share; remove seller
            land.citizenshipNumbers[sellerIndex] = land.citizenshipNumbers[numOwners - 1];
            land.citizenshipNumbers.pop();
        } else {
            // In-place replacement saves gas compared to swap + pop + push
            land.citizenshipNumbers[sellerIndex] = _buyerCitizenshipNo;
        }

        emit PropertyTransferred(_landId, _sellerCitizenshipNo, _buyerCitizenshipNo, _price);
    }

    function setLandCategory(uint256 _landId, LandCategory _newCategory) external onlyOfficer landExists(_landId) {
        Property storage land = properties[_landId];
        if (land.isFrozen) revert PropertyIsFrozen();

        LandCategory oldCategory = land.category;
        if (oldCategory == _newCategory) revert SameCategoryError();

        land.category = _newCategory;
        emit LandCategoryUpdated(_landId, oldCategory, _newCategory);
    }

    // View Functions
    function getLand(uint256 _landId)
        external
        view
        landExists(_landId)
        returns (
            uint256 landId,
            string memory lalpurjaNo,
            bytes32 documentHash,
            CadastralAddress memory cadastral,
            LandCategory category,
            uint256 areaInSqMeters,
            bool isFrozen,
            string[] memory ownerCitizenshipNumbers,
            Coordinate[] memory boundaries
        )
    {
        Property memory land = properties[_landId];
        return (
            land.landId,
            land.lalpurjaNo,
            land.documentHash,
            land.cadastral,
            land.category,
            land.areaInSqMeters,
            land.isFrozen,
            land.citizenshipNumbers,
            landBoundaries[_landId]
        );
    }

    function getLandsByCitizen(string memory _citizenshipNo) external view returns (uint256[] memory) {
        return citizenToLandIds[_citizenshipNo];
    }

    function getLandsByWard(string memory _district, string memory _localGovernment, uint8 _wardNumber)
        external
        view
        returns (uint256[] memory)
    {
        bytes32 wardKey = keccak256(abi.encode(_district, _localGovernment, _wardNumber));
        return wardToLandIds[wardKey];
    }

    function getLandBoundaries(uint256 _landId) external view landExists(_landId) returns (Coordinate[] memory) {
        return landBoundaries[_landId];
    }

    function verifyDocumentHash(uint256 _landId, bytes32 _submittedHash)
        external
        view
        landExists(_landId)
        returns (bool)
    {
        return properties[_landId].documentHash == _submittedHash;
    }
}
