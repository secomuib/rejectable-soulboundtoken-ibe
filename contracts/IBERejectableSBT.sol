// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./SBT/ISBT.sol";
import "./SBT/IRejectableSBT.sol";
import "./SBT/ISBTMetadata.sol";

/// @title Test SBT with IBE parameters
/// @notice Soulbound token test contract
contract IBERejectableSBT is
    Context,
    ERC165,
    ISBT,
    IRejectableSBT,
    ISBTMetadata,
    Ownable
{
    using Strings for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

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

    // address of the middleware which will send the private key
    address public middleware;

    enum State {
        Minted,
        Accepted,
        Rejected,
        Cancelled,
        PrivateKeySent,
        Expired
    }

    struct MessageData {
        // identity of the receiver
        address idReceiver;
        uint256 idTimestamp;
        // deadline
        uint256 deadline;
        // hash of the message
        bytes messageHash;
        // hash of the cipher of the message, encrypted with the identity of the receiver
        bytes ciphertextHash;
        // private key to decrypt the cipher
        bytes privateKey_x;
        bytes privateKey_y;
        State state;
    }

    // Mapping from token ID to message data
    mapping(uint256 => MessageData) public messageData;

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
        address middleware_,
        bytes memory fieldOrder_,
        bytes memory subgroupOrder_,
        bytes memory pointP_x_,
        bytes memory pointP_y_,
        bytes memory pointPpublic_x_,
        bytes memory pointPpublic_y_
    ) {
        _name = name_;
        _symbol = symbol_;

        middleware = middleware_;

        fieldOrder = fieldOrder_;
        subgroupOrder = subgroupOrder_;
        pointP_x = pointP_x_;
        pointP_y = pointP_y_;
        pointPpublic_x = pointPpublic_x_;
        pointPpublic_y = pointPpublic_y_;
    }

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

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

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

    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    function _isOwner(address spender, uint256 tokenId)
        internal
        view
        virtual
        returns (bool)
    {
        require(_exists(tokenId), "SBT: operator query for nonexistent token");
        address owner = IBERejectableSBT.ownerOf(tokenId);
        return (spender == owner);
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _minters[tokenId] != address(0);
    }

    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "SBT: invalid token ID");
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

    function ownerOf(uint256 tokenId)
        public
        view
        virtual
        override
        returns (address)
    {
        address owner = _owners[tokenId];
        return owner;
    }

    function minterOf(uint256 tokenId) public view returns (address) {
        address minter = _minters[tokenId];
        return minter;
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "SBT: mint to the zero address");
        require(!_exists(tokenId), "SBT: token already minted");

        _minters[tokenId] = _msgSender();
        _transferableOwners[tokenId] = to;

        emit TransferRequest(address(0), to, tokenId);
    }

    function mint(
        address to,
        uint256 timestamp,
        uint256 deadline,
        bytes memory messageHash,
        bytes memory ciphertextHash
    ) public returns (uint256) {
        require(to != address(0), "IBERejectableSBT: mint to the zero address");
        require(
            deadline > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            keccak256(abi.encodePacked((messageHash))) !=
                keccak256(abi.encodePacked((""))),
            "IBERejectableSBT: message hash is empty"
        );
        require(
            keccak256(abi.encodePacked((ciphertextHash))) !=
                keccak256(abi.encodePacked((""))),
            "IBERejectableSBT: cipher hash is empty"
        );

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(to, tokenId);

        messageData[tokenId] = MessageData({
            idReceiver: to,
            idTimestamp: timestamp,
            deadline: deadline,
            messageHash: messageHash,
            ciphertextHash: ciphertextHash,
            privateKey_x: "",
            privateKey_y: "",
            state: State.Minted
        });

        return tokenId;
    }

    function acceptTransfer(uint256 tokenId) public override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "IBERejectableSBT: accept transfer caller is not the receiver of the token"
        );
        require(
            messageData[tokenId].deadline > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            messageData[tokenId].state == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = IBERejectableSBT.ownerOf(tokenId);
        address to = _msgSender();

        if (from != address(0)) {
            // Perhaps previous owner is address(0), when minting
            _balances[from] -= 1;
        }
        _balances[to] += 1;
        _owners[tokenId] = to;
        messageData[tokenId].state = State.Accepted;

        // remove the transferable owner from the mapping
        _transferableOwners[tokenId] = address(0);

        emit AcceptTransfer(from, to, tokenId);
    }

    function rejectTransfer(uint256 tokenId) public override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "IBERejectableSBT: reject transfer caller is not the receiver of the token"
        );
        require(
            messageData[tokenId].deadline > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            messageData[tokenId].state == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = IBERejectableSBT.ownerOf(tokenId);
        address to = _msgSender();

        messageData[tokenId].state = State.Rejected;
        _transferableOwners[tokenId] = address(0);

        emit RejectTransfer(from, to, tokenId);
    }

    function cancelTransfer(uint256 tokenId) public override {
        //solhint-disable-next-line max-line-length
        require(
            // perhaps previous owner is address(0), when minting
            (IBERejectableSBT.ownerOf(tokenId) == address(0) &&
                _minters[tokenId] == _msgSender()) ||
                _isOwner(_msgSender(), tokenId),
            "SBT: transfer caller is not owner nor approved"
        );
        require(
            messageData[tokenId].state == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = IBERejectableSBT.ownerOf(tokenId);
        address to = _transferableOwners[tokenId];

        require(
            to != address(0),
            "IBERejectableSBT: token is not transferable"
        );
        _transferableOwners[tokenId] = address(0);
        messageData[tokenId].state = State.Cancelled;

        emit CancelTransfer(from, to, tokenId);
    }

    function sendPrivateKey(
        uint256 tokenId,
        bytes memory privateKey_x,
        bytes memory privateKey_y
    ) public {
        require(
            _msgSender() == middleware,
            "IBERejectableSBT: caller is not the middleware"
        );
        require(_exists(tokenId), "IBERejectableSBT: token does not exist");
        require(
            keccak256(abi.encodePacked((messageData[tokenId].privateKey_x))) ==
                keccak256(abi.encodePacked((""))),
            "IBERejectableSBT: private key already sent"
        );
        require(
            keccak256(abi.encodePacked((messageData[tokenId].privateKey_y))) ==
                keccak256(abi.encodePacked((""))),
            "IBERejectableSBT: private key already sent"
        );
        require(
            messageData[tokenId].state == State.Accepted,
            "IBERejectableSBT: token is not in accepted state"
        );

        messageData[tokenId].privateKey_x = privateKey_x;
        messageData[tokenId].privateKey_y = privateKey_y;
        messageData[tokenId].state = State.PrivateKeySent;

        emit PrivateKeySent(tokenId, privateKey_x, privateKey_y);
    }

    function getState(uint256 tokenId) public view returns (State) {
        _requireMinted(tokenId);
        if (messageData[tokenId].state == State.PrivateKeySent) {
            return State.PrivateKeySent;
        } else if (messageData[tokenId].state == State.Rejected) {
            return State.Rejected;
        } else if (messageData[tokenId].state == State.Cancelled) {
            return State.Cancelled;
        } else if (messageData[tokenId].state == State.Accepted) {
            return State.Accepted;
        } else if (messageData[tokenId].deadline < block.timestamp) {
            return State.Expired;
        }
        return State.Minted;
    }

    event PrivateKeySent(
        uint256 tokenId,
        bytes privateKey_x,
        bytes privateKey_y
    );
}
