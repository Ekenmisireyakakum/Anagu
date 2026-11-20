// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title LandToken
 * @notice ERC-20 settlement & platform utility token for Polygon land access and transfers.
 * Can be deployed alongside LandTitleNFT (ERC-721) or replaced by any existing ERC-20 address via env config.
 */
contract LandToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        address admin,
        uint256 initialSupply
    ) ERC20("ANAGU Land Token", "ALT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        if (initialSupply > 0) {
            _mint(admin, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
