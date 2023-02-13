// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./SBT/RejectableSBT.sol";
import "./SBT/extensions/SBTEnumerable.sol";
import "./SBT/extensions/SBTBurnable.sol";

/// @title Test SBT
/// @notice Soulbound token test contract
contract TestRejectableSBT is RejectableSBT, SBTEnumerable, SBTBurnable {
    string private _baseTokenURI;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_
    ) RejectableSBT(name_, symbol_) {
        _baseTokenURI = baseTokenURI_;
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256
    ) internal virtual override(RejectableSBT, SBTEnumerable) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(RejectableSBT, SBTEnumerable)
        returns (bool)
    {
        return
            interfaceId == type(ISBTEnumerable).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
