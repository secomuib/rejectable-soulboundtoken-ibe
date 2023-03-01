// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "./RejectableSBT.sol";

/// @title Rejectable SBT with deadline
/// @notice Rejectable Soulbound token with deadline is an NFT token that is
/// not transferable and can be rejected when we mint it to an address.
/// The token can be rejected/accepted only before the deadline.
contract RejectableSBTDeadline is RejectableSBT {
    enum State {
        Minted,
        Accepted,
        Rejected,
        Cancelled,
        Expired
    }

    // Mapping from token ID to state
    mapping(uint256 => State) internal _states;

    // Mapping from token ID to deadline
    mapping(uint256 => uint256) internal _deadlines;

    constructor(string memory name_, string memory symbol_)
        RejectableSBT(name_, symbol_)
    {}

    function getDeadline(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {
        require(
            _exists(tokenId),
            "RejectableSBTDeadline: token does not exist"
        );
        return _deadlines[tokenId];
    }

    function _mint(address, uint256) internal virtual override {
        revert("RejectableSBTDeadline: mint without deadline is not allowed");
    }

    function _mint(
        address to,
        uint256 tokenId,
        uint256 deadline
    ) internal virtual {
        require(
            to != address(0),
            "RejectableSBTDeadline: mint to the zero address"
        );
        require(
            !_exists(tokenId),
            "RejectableSBTDeadline: token already minted"
        );
        require(
            deadline > block.timestamp,
            "RejectableSBTDeadline: deadline expired"
        );

        _minters[tokenId] = _msgSender();
        _transferableOwners[tokenId] = to;
        _deadlines[tokenId] = deadline;
        _states[tokenId] = State.Minted;

        emit TransferRequest(_msgSender(), to, tokenId);
    }

    function acceptTransfer(uint256 tokenId) public virtual override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBTDeadline: accept transfer caller is not the receiver of the token"
        );
        require(
            _deadlines[tokenId] > block.timestamp,
            "RejectableSBTDeadline: deadline expired"
        );
        require(
            _states[tokenId] == State.Minted,
            "RejectableSBTDeadline: token is not in minted state"
        );

        address from = minterOf(tokenId);
        address to = _msgSender();

        _balances[to] += 1;
        _owners[tokenId] = to;
        _states[tokenId] = State.Accepted;
        // remove the transferable owner from the mapping
        _transferableOwners[tokenId] = address(0);

        emit AcceptTransfer(from, to, tokenId);
    }

    function rejectTransfer(uint256 tokenId) public virtual override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBTDeadline: reject transfer caller is not the receiver of the token"
        );
        require(
            _deadlines[tokenId] > block.timestamp,
            "RejectableSBTDeadline: deadline expired"
        );
        require(
            _states[tokenId] == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = minterOf(tokenId);
        address to = _msgSender();

        _states[tokenId] = State.Rejected;
        _transferableOwners[tokenId] = address(0);

        emit RejectTransfer(from, to, tokenId);
    }

    function cancelTransfer(uint256 tokenId) public virtual override {
        require(
            minterOf(tokenId) == _msgSender(),
            "RejectableSBTDeadline: cancel transfer caller is not the minter of the token"
        );
        require(
            _states[tokenId] == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = minterOf(tokenId);
        address to = _transferableOwners[tokenId];

        require(
            to != address(0),
            "RejectableSBTDeadline: token is not transferable"
        );

        _states[tokenId] = State.Cancelled;
        _transferableOwners[tokenId] = address(0);

        emit CancelTransfer(from, to, tokenId);
    }
}
