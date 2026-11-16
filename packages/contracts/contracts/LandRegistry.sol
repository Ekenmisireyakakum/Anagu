// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LandTitleNFT.sol";

contract LandRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    enum RecordStatus { Active, Transferred, Revoked, Cancelled }

    struct LandRecord {
        uint256 tokenId;
        string parcelReference;
        address currentOwner;
        bytes32 spatialHash;
        bytes32 ownerReference;
        bytes32 documentHash;
        uint256 registeredAt;
        uint256 lastUpdatedAt;
        RecordStatus status;
    }

    mapping(string => LandRecord) public records;
    mapping(string => address[]) public ownershipHistory;
    uint256 private _tokenIdCounter = 1;
    LandTitleNFT public landTitleNFT;

    event LandRegistered(string indexed parcelReference, uint256 indexed tokenId, address indexed owner);
    event OwnershipTransferred(string indexed parcelReference, uint256 indexed tokenId, address indexed from, address to);
    event LandRevoked(string indexed parcelReference, uint256 indexed tokenId, string grounds);

    constructor(address admin, address _landTitleNFT) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
        landTitleNFT = LandTitleNFT(_landTitleNFT);
    }

    function registerLand(
        address owner,
        string memory parcelReference,
        bytes32 spatialHash,
        bytes32 ownerReference,
        bytes32 documentHash,
        string memory tokenUri
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant {
        require(records[parcelReference].registeredAt == 0, "LandRegistry: already registered");
        uint256 tokenId = _tokenIdCounter;
        landTitleNFT.mint(owner, tokenId, tokenUri, parcelReference, spatialHash, ownerReference, documentHash);
        records[parcelReference] = LandRecord({
            tokenId: tokenId,
            parcelReference: parcelReference,
            currentOwner: owner,
            spatialHash: spatialHash,
            ownerReference: ownerReference,
            documentHash: documentHash,
            registeredAt: block.timestamp,
            lastUpdatedAt: block.timestamp,
            status: RecordStatus.Active
        });
        ownershipHistory[parcelReference].push(owner);
        _tokenIdCounter++;
        emit LandRegistered(parcelReference, tokenId, owner);
    }

    function transferOwnership(
        string memory parcelReference,
        address newOwner
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant {
        LandRecord storage record = records[parcelReference];
        require(record.status == RecordStatus.Active, "LandRegistry: record not active");
        address oldOwner = record.currentOwner;
        uint256 tokenId = record.tokenId;
        landTitleNFT.registryTransfer(oldOwner, newOwner, tokenId);
        record.currentOwner = newOwner;
        record.status = RecordStatus.Active;
        record.lastUpdatedAt = block.timestamp;
        ownershipHistory[parcelReference].push(newOwner);
        emit OwnershipTransferred(parcelReference, tokenId, oldOwner, newOwner);
    }

    function revokeTitle(
        string memory parcelReference,
        string memory grounds
    ) external onlyRole(GOVERNOR_ROLE) nonReentrant {
        LandRecord storage record = records[parcelReference];
        require(record.registeredAt != 0, "LandRegistry: record does not exist");
        require(record.status == RecordStatus.Active, "LandRegistry: record not active");
        uint256 tokenId = record.tokenId;
        landTitleNFT.revoke(tokenId, grounds);
        record.status = RecordStatus.Revoked;
        record.lastUpdatedAt = block.timestamp;
        emit LandRevoked(parcelReference, tokenId, grounds);
    }

    function getRecord(string memory parcelReference) external view returns (LandRecord memory) {
        return records[parcelReference];
    }

    function getOwnershipHistory(string memory parcelReference) external view returns (address[] memory) {
        return ownershipHistory[parcelReference];
    }
}
