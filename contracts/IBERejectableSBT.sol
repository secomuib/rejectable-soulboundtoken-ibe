// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

import "./SBT/RejectableSBT.sol";

/// @title Test SBT with IBE parameters
/// @notice Soulbound token test contract
contract IBERejectableSBT is RejectableSBT, EIP712 {
    // public parameters of the IBE algorithm
    bytes public fieldOrder;
    bytes public subgroupOrder;
    bytes public pointP_x;
    bytes public pointP_y;
    bytes public pointPpublic_x;
    bytes public pointPpublic_y;

    constructor(
        string memory name_,
        string memory symbol_,
        bytes memory fieldOrder_,
        bytes memory subgroupOrder_,
        bytes memory pointP_x_,
        bytes memory pointP_y_,
        bytes memory pointPpublic_x_,
        bytes memory pointPpublic_y_
    ) RejectableSBT(name_, symbol_) EIP712("IBERejectableSBT", "1") {
        fieldOrder = fieldOrder_;
        subgroupOrder = subgroupOrder_;
        pointP_x = pointP_x_;
        pointP_y = pointP_y_;
        pointPpublic_x = pointPpublic_x_;
        pointPpublic_y = pointPpublic_y_;
    }
}
