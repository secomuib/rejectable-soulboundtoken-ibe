// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./ISBT.sol";
import "./IRejectableSBT.sol";
import "./ISBTMetadata.sol";

/// @title SBT
/// @notice Soulbound token is an NFT token that is not transferable.
contract RejectableSBT is
    Context,
    ERC165,
    ISBT,
    IRejectableSBT,
    ISBTMetadata,
    Ownable
{
    using Strings for uint256;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to minter address
    mapping(uint256 => address) private _minters;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping from token ID to transferable owner
    mapping(uint256 => address) private _transferableOwners;

    // Mapping owner address to token count
    mapping(address => uint256) private _balances;

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(ISBT).interfaceId ||
            interfaceId == type(ISBTMetadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {ISBT-balanceOf}.
     */
    function balanceOf(address owner)
        public
        view
        virtual
        override
        returns (uint256)
    {
        require(owner != address(0), "SBT: address zero is not a valid owner");
        return _balances[owner];
    }

    /**
     * @dev See {ISBTMetadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {ISBTMetadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {ISBTMetadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        _requireMinted(tokenId);

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : "";
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overridden in child contracts.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isOwner(address spender, uint256 tokenId)
        internal
        view
        virtual
        returns (bool)
    {
        require(_exists(tokenId), "SBT: operator query for nonexistent token");
        address owner = RejectableSBT.ownerOf(tokenId);
        return (spender == owner);
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
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
    function _burn(uint256 tokenId) internal virtual {
        address owner = RejectableSBT.ownerOf(tokenId);

        _beforeTokenTransfer(owner, address(0), tokenId);

        _balances[owner] -= 1;
        delete _minters[tokenId];
        delete _owners[tokenId];

        emit Burn(owner, tokenId);

        _afterTokenTransfer(owner, address(0), tokenId);
    }

    /**
     * @dev Reverts if the `tokenId` has not been minted yet.
     */
    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "SBT: invalid token ID");
    }

    /**
     * @dev Hook that is called before any token minting/burning
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
     * transferred to `to`.
     * - When `from` is zero, `tokenId` will be minted for `to`.
     * - When `to` is zero, ``from``'s `tokenId` will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address,
        address,
        uint256
    ) internal virtual {}

    /**
     * @dev Hook that is called after any minting/burning of tokens
     *
     * Calling conditions:
     * - when `from` and `to` are both non-zero.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(
        address,
        address,
        uint256
    ) internal virtual {}

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
        override
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
    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "SBT: mint to the zero address");
        require(!_exists(tokenId), "SBT: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);

        _minters[tokenId] = _msgSender();
        _transferableOwners[tokenId] = to;

        emit TransferRequest(address(0), to, tokenId);
        /* _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId); */

        _afterTokenTransfer(address(0), to, tokenId);
    }

    function acceptTransfer(uint256 tokenId) public override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBT: accept transfer caller is not the receiver of the token"
        );

        address from = RejectableSBT.ownerOf(tokenId);
        address to = _msgSender();

        if (from != address(0)) {
            // Perhaps previous owner is address(0), when minting
            _balances[from] -= 1;
        }
        _balances[to] += 1;
        _owners[tokenId] = to;

        // remove the transferable owner from the mapping
        _transferableOwners[tokenId] = address(0);

        emit AcceptTransfer(from, to, tokenId);
    }

    function rejectTransfer(uint256 tokenId) public override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "RejectableSBT: reject transfer caller is not the receiver of the token"
        );

        address from = RejectableSBT.ownerOf(tokenId);
        address to = _msgSender();

        _transferableOwners[tokenId] = address(0);

        emit RejectTransfer(from, to, tokenId);
    }

    function cancelTransfer(uint256 tokenId) public override {
        //solhint-disable-next-line max-line-length
        require(
            // perhaps previous owner is address(0), when minting
            (RejectableSBT.ownerOf(tokenId) == address(0) &&
                _minters[tokenId] == _msgSender()) ||
                _isOwner(_msgSender(), tokenId),
            "SBT: transfer caller is not owner nor approved"
        );

        address from = RejectableSBT.ownerOf(tokenId);
        address to = _transferableOwners[tokenId];

        require(to != address(0), "RejectableSBT: token is not transferable");
        _transferableOwners[tokenId] = address(0);

        emit CancelTransfer(from, to, tokenId);
    }
}
