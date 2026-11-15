// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @dev Advisory registry only. QBFT consensus is not modified by this contract.
contract ValidatorRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping(address => uint256) public validatorWeight;
    mapping(address => bool) public isValidator;
    address[] private _validators;

    event ValidatorAdded(address indexed validator, uint256 weight);
    event ValidatorRemoved(address indexed validator);
    event ValidatorWeightUpdated(address indexed validator, uint256 weight);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function addValidator(address validator, uint256 weight) external onlyRole(ADMIN_ROLE) {
        require(!isValidator[validator], "ValidatorRegistry: already a validator");
        isValidator[validator] = true;
        validatorWeight[validator] = weight;
        _validators.push(validator);
        emit ValidatorAdded(validator, weight);
    }

    function removeValidator(address validator) external onlyRole(ADMIN_ROLE) {
        require(isValidator[validator], "ValidatorRegistry: not a validator");
        isValidator[validator] = false;
        validatorWeight[validator] = 0;
        for (uint256 i = 0; i < _validators.length; i++) {
            if (_validators[i] == validator) {
                _validators[i] = _validators[_validators.length - 1];
                _validators.pop();
                break;
            }
        }
        emit ValidatorRemoved(validator);
    }

    function updateWeight(address validator, uint256 weight) external onlyRole(ADMIN_ROLE) {
        require(isValidator[validator], "ValidatorRegistry: not a validator");
        validatorWeight[validator] = weight;
        emit ValidatorWeightUpdated(validator, weight);
    }

    function getValidators() external view returns (address[] memory) {
        return _validators;
    }

    function getTotalWeight() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _validators.length; i++) {
            total += validatorWeight[_validators[i]];
        }
        return total;
    }
}
