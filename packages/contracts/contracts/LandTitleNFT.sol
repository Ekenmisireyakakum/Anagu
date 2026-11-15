// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LandTitleNFT is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    struct TitleMetadata {
        string parcelReference;
        bytes32 spatialHash;
        bytes32 ownerReference;
        bytes32 documentHash;
        uint256 issuedAt;
        bool isRevoked;
        uint256 revokedAt;
        string revocationGrounds;
        address revokedBy;
    }

    mapping(uint256 => TitleMetadata) public titleMetadata;
    mapping(uint256 => bool) public isRevoked;

    event TitleIssued(uint256 indexed tokenId, address indexed to);
    event TitleRevoked(uint256 indexed tokenId, address indexed by, string grounds);

    constructor(address admin) ERC721("LandTitleNFT", "LTN") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
    }

    function mint(
        address to,
        uint256 tokenId,
        string memory uri,
        string memory parcelReference,
        bytes32 spatialHash,
        bytes32 ownerReference,
        bytes32 documentHash
    ) external onlyRole(REGISTRY_ROLE) {
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        titleMetadata[tokenId] = TitleMetadata({
            parcelReference: parcelReference,
            spatialHash: spatialHash,
            ownerReference: ownerReference,
            documentHash: documentHash,
            issuedAt: block.timestamp,
            isRevoked: false,
            revokedAt: 0,
            revocationGrounds: "",
            revokedBy: address(0)
        });
        emit TitleIssued(tokenId, to);
    }

    function burn(uint256 tokenId) external onlyRole(REGISTRY_ROLE) {
        _burn(tokenId);
    }

    function revoke(uint256 tokenId, string memory grounds) external onlyRole(GOVERNOR_ROLE) {
        require(!isRevoked[tokenId], "LandTitleNFT: already revoked");
        isRevoked[tokenId] = true;
        titleMetadata[tokenId].isRevoked = true;
        titleMetadata[tokenId].revokedAt = block.timestamp;
        titleMetadata[tokenId].revocationGrounds = grounds;
        titleMetadata[tokenId].revokedBy = msg.sender;
        emit TitleRevoked(tokenId, msg.sender, grounds);
    }

    function getTitleMetadata(uint256 tokenId) external view returns (TitleMetadata memory) {
        return titleMetadata[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        // Block transfers of revoked titles
        if (isRevoked[tokenId] && to != address(0)) {
            revert("LandTitleNFT: title is revoked");
        }
        // Block direct user-to-user transfers (allow mint where auth is address(0), and registry role)
        if (auth != address(0) && !hasRole(REGISTRY_ROLE, auth)) {
            revert("LandTitleNFT: direct transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
