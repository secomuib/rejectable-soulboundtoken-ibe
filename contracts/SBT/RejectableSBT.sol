// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "./SBT.sol";
import "./IRejectableSBT.sol";

/// @title Rejectable SBT
/// @notice Rejectable Soulbound token is an NFT token that is not transferable and
/// can be rejected when we mint it to an address.
contract RejectableSBT is SBT, IRejectableSBT {
    // Mapping from token ID to minter address
    mapping(uint256 => address) internal _minters;

    // Mapping from token ID to transferable owner
    mapping(uint256 => address) internal _transferableOwners;

    constructor(string memory name_, string memory symbol_)
        SBT(name_, symbol_)
    {}

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId)
        internal
        view
        virtual
        override
        returns (bool)
    {
        return _minters[tokenId] != address(0);
    }

    /**
     * @dev Destroys `tokenId`.
     *
     * Requirements:
     * - `tokenId` must exist.
     *
     * Emits a {Burn} event.
     */
    function _burn(uint256 tokenId) internal virtual override {
        address owner = ownerOf(tokenId);

        _balances[owner] -= 1;
        delete _minters[tokenId];
        delete _owners[tokenId];

        emit Burn(owner, tokenId);
    }

    function transferableOwnerOf(uint256 tokenId)
        public
        view
        virtual
        override
        returns (address)
    {
        address owner = _transferableOwners[tokenId];

        return owner;
    }

    /**
     * @dev See {ISBT-ownerOf}.
     */
    function ownerOf(uint256 tokenId)
        public
        view
        virtual
        override(SBT, ISBT)
        returns (address)
    {
        address owner = _owners[tokenId];
        // removed check, because when a token is minted, the owner is address(0)
        // require(owner != address(0), "SBT: owner query for nonexistent token");
        return owner;
    }

    function minterOf(uint256 tokenId) public view returns (address) {
        address minter = _minters[tokenId];
        return minter;
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {TransferRequest} event.
     */
    function _mint(address to, uint256 tokenId) internal virtual override {
        require(to != address(0), "RejectableSBT: mint to the zero address");
        require(!_exists(tokenId), "RejectableSBT: token already minted");

        _minters[tokenId] = _msgSender();
        _transferableOwners[tokenId] = to;

        emit TransferRequest(_msgSender(), to, tokenId);
    }

    function acceptTransfer(uint256 tokenId) public virtual override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBT: accept transfer caller is not the receiver of the token"
        );

        address from = minterOf(tokenId);
        address to = _msgSender();

        _balances[to] += 1;
        _owners[tokenId] = to;
        // remove the transferable owner from the mapping
        _transferableOwners[tokenId] = address(0);

        emit AcceptTransfer(from, to, tokenId);
    }

    function rejectTransfer(uint256 tokenId) public virtual override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBT: reject transfer caller is not the receiver of the token"
        );

        address from = minterOf(tokenId);
        address to = _msgSender();

        _transferableOwners[tokenId] = address(0);

        emit RejectTransfer(from, to, tokenId);
    }

    function cancelTransfer(uint256 tokenId) public virtual override {
        require(
            minterOf(tokenId) == _msgSender(),
            "RejectableSBT: cancel transfer caller is not the minter of the token"
        );

        address from = minterOf(tokenId);
        address to = _transferableOwners[tokenId];

        require(to != address(0), "RejectableSBT: token is not transferable");

        _transferableOwners[tokenId] = address(0);

        emit CancelTransfer(from, to, tokenId);
    }
}
