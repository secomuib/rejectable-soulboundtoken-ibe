// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./SBT/RejectableSBT.sol";

/// @title Test SBT
/// @notice Soulbound token test contract
contract TestRejectableSBT is RejectableSBT {

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_
    ) RejectableSBT(name_, symbol_) {
    }
}
