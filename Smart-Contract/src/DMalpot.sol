// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract DMalpot is Ownable, ReentrancyGuard {


enum LandCategory { Residential, Agricultural, Commercial, Industrial, Government }
enum TransferStatus { NonExistent, Pending, Executed, Cancelled }

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

  struct LandTransferRequest {
    uint256 requestId;
    uint256 landId;
    string sellerCitizenshipNo;
    string buyerCitizenshipNo;
    uint256 price;
    TransferStatus status;
    uint256 createdAt;
  }


  uint256 public nextTransferRequestId = 1;

  mapping(address => bool) public isOfficer;
  mapping(uint256 => Property) public properties;
  
  // Uniqueness Enforcers
  mapping(bytes32 => bool) private cadastralHashes;
  mapping(bytes32 => bool) private lalpurjaHashes;
  mapping(bytes32 => bool) public documentHashes; 
  mapping(uint256 => Coordinate[]) private landBoundaries;
  mapping(string => uint256[]) private citizenToLandIds;
  mapping(bytes32 => uint256[]) private wardToLandIds;
  mapping(uint256 => LandTransferRequest) public transferRequests;
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
  event LandFreezeStatusChanged(uint256 indexed landId, bool isFrozen);
  event TransferRequested(uint256 indexed requestId, uint256 indexed landId, string seller, string buyer, uint256 price);
  event TransferExecuted(uint256 indexed requestId, uint256 indexed landId);
  event TransferCancelled(uint256 indexed requestId, uint256 indexed landId);

  modifier onlyOfficer() {
    require(isOfficer[msg.sender] || msg.sender == owner(), "DMalpot: Caller is not authorized officer");
    _;
  }

  modifier landExists(uint256 _landId) {
    require(properties[_landId].isRegistered, "DMalpot: Land ID does not exist");
    _;
  }

  constructor(address initialAdmin) Ownable(initialAdmin) {
    require(initialAdmin != address(0), "DMalpot: Invalid admin address");
    isOfficer[initialAdmin] = true;
    emit OfficerStatusUpdated(initialAdmin, true);
  }


  function setOfficerStatus(address _officer, bool _status) external onlyOwner {
    require(_officer != address(0), "DMalpot: Invalid officer address");
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
  ) public onlyOfficer nonReentrant {
    require(!properties[_landId].isRegistered, "DMalpot: Land ID already registered");
    require(_documentHash != bytes32(0), "DMalpot: Document hash required");
    require(!documentHashes[_documentHash], "DMalpot: Document hash already exists on-chain");
    require(_citizenshipNumbers.length > 0, "DMalpot: At least one owner required");
    require(_latitudes.length == _longitudes.length, "DMalpot: Lat/Long array length mismatch");
    require(_latitudes.length >= 3, "DMalpot: At least 3 boundary coordinates required for a polygon");

    bytes32 lalpurjaHashKey = keccak256(abi.encodePacked(_lalpurjaNo));
    require(!lalpurjaHashes[lalpurjaHashKey], "DMalpot: Lalpurja number already exists");

    bytes32 cadastralHashKey = keccak256(abi.encodePacked(
      _cadastral.district,
      _cadastral.localGovernment,
      _cadastral.wardNumber,
      _cadastral.kittaNumber
    ));
    require(!cadastralHashes[cadastralHashKey], "DMalpot: Kitta number already registered in this ward");

    Property storage land = properties[_landId];
    land.landId = _landId;
    land.lalpurjaNo = _lalpurjaNo;
    land.documentHash = _documentHash;
    land.cadastral = _cadastral;
    land.category = _category;
    land.areaInSqMeters = _areaInSqMeters;
    land.isFrozen = false;
    land.isRegistered = true;
    land.citizenshipNumbers = _citizenshipNumbers;

    lalpurjaHashes[lalpurjaHashKey] = true;
    cadastralHashes[cadastralHashKey] = true;
    documentHashes[_documentHash] = true;

    for (uint256 i = 0; i < _latitudes.length; i++) {
      landBoundaries[_landId].push(Coordinate({
        latitude: _latitudes[i],
        longitude: _longitudes[i]
      }));
    }

    for (uint256 j = 0; j < _citizenshipNumbers.length; j++) {
      citizenToLandIds[_citizenshipNumbers[j]].push(_landId);
    }

    bytes32 wardKey = keccak256(abi.encodePacked(_cadastral.district, _cadastral.localGovernment, _cadastral.wardNumber));
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


  
}