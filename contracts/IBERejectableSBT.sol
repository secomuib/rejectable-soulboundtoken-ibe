// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./SBT/RejectableSBT.sol";

/// @title Test rejectable SBT with IBE parameters and deadline for accepting
/// and sending the private key
/// @notice Soulbound token test contract
contract IBERejectableSBT is RejectableSBT {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    enum State {
        Minted,
        Accepted,
        Rejected,
        Cancelled,
        PrivateKeySent,
        ExpiredAccept,
        ExpiredPrivateKey
    }

    // Mapping from token ID to state
    mapping(uint256 => State) internal _states;

    // Mapping from token ID to deadline for accepting
    mapping(uint256 => uint256) internal _deadlineAccept;
    // Mapping from token ID to deadline for sending the private key
    mapping(uint256 => uint256) internal _deadlinePrivateKey;

    // address of the middleware which will send the private key
    address public middleware;

    struct MessageData {
        // identity of the receiver
        address idReceiver;
        uint256 idTimestamp;
        // hash of the message in plain text
        bytes messageHash;
        // hash of the cipher of the message
        bytes encryptedMessageHash;
        // the cipher of the AES key, encrypted with the identity of the receiver
        bytes encryptedKey_cipherU_x;
        bytes encryptedKey_cipherU_y;
        string encryptedKey_cipherV;
        string encryptedKey_cipherW;
        // private key to decrypt the cipher
        bytes privateKey_x;
        bytes privateKey_y;
    }

    // Mapping from token ID to message data
    mapping(uint256 => MessageData) public messageData;

    // public parameter of the AES algorithm
    bytes public aesInitializationVector;
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
        bytes memory aesInitializationVector_,
        bytes memory fieldOrder_,
        bytes memory subgroupOrder_,
        bytes memory pointP_x_,
        bytes memory pointP_y_,
        bytes memory pointPpublic_x_,
        bytes memory pointPpublic_y_
    ) RejectableSBT(name_, symbol_) {
        middleware = middleware_;

        aesInitializationVector = aesInitializationVector_;

        fieldOrder = fieldOrder_;
        subgroupOrder = subgroupOrder_;
        pointP_x = pointP_x_;
        pointP_y = pointP_y_;
        pointPpublic_x = pointPpublic_x_;
        pointPpublic_y = pointPpublic_y_;
    }

    function _mint(address, uint256) internal virtual override {
        revert("IBERejectableSBT: mint without deadline is not allowed");
    }

    function _mint(
        address to,
        uint256 tokenId,
        uint256 deadlineAccept,
        uint256 deadlinePrivateKey
    ) internal virtual {
        require(to != address(0), "IBERejectableSBT: mint to the zero address");
        require(!_exists(tokenId), "IBERejectableSBT: token already minted");
        require(
            deadlineAccept > block.timestamp,
            "IBERejectableSBT: deadline for accept expired"
        );
        require(
            deadlinePrivateKey > block.timestamp,
            "IBERejectableSBT: deadline for send private key expired"
        );

        _minters[tokenId] = _msgSender();
        _transferableOwners[tokenId] = to;
        _deadlineAccept[tokenId] = deadlineAccept;
        _deadlinePrivateKey[tokenId] = deadlinePrivateKey;
        _states[tokenId] = State.Minted;

        emit TransferRequest(_msgSender(), to, tokenId);
    }

    function mint(
        address to,
        uint256 timestamp,
        uint256 deadlineAccept,
        uint256 deadlinePrivateKey,
        bytes memory messageHash,
        bytes memory encryptedMessageHash,
        bytes memory encryptedKey_cipherU_x,
        bytes memory encryptedKey_cipherU_y,
        string memory encryptedKey_cipherV,
        string memory encryptedKey_cipherW
    ) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(to, tokenId, deadlineAccept, deadlinePrivateKey);

        messageData[tokenId] = MessageData({
            idReceiver: to,
            idTimestamp: timestamp,
            messageHash: messageHash,
            encryptedMessageHash: encryptedMessageHash,
            encryptedKey_cipherU_x: encryptedKey_cipherU_x,
            encryptedKey_cipherU_y: encryptedKey_cipherU_y,
            encryptedKey_cipherV: encryptedKey_cipherV,
            encryptedKey_cipherW: encryptedKey_cipherW,
            privateKey_x: "",
            privateKey_y: ""
        });

        return tokenId;
    }

    function acceptTransfer(uint256 tokenId) public virtual override {
        require(
            _transferableOwners[tokenId] == _msgSender(),
            "IBERejectableSBT: accept transfer caller is not the receiver of the token"
        );
        require(
            _deadlineAccept[tokenId] > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            _states[tokenId] == State.Minted,
            "IBERejectableSBT: token is not in minted state"
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
            "IBERejectableSBT: reject transfer caller is not the receiver of the token"
        );
        require(
            _deadlineAccept[tokenId] > block.timestamp,
            "IBERejectableSBT: deadline expired"
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
            "IBERejectableSBT: cancel transfer caller is not the minter of the token"
        );
        require(
            _deadlineAccept[tokenId] > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            _states[tokenId] == State.Minted,
            "IBERejectableSBT: token is not in minted state"
        );

        address from = minterOf(tokenId);
        address to = _transferableOwners[tokenId];

        require(
            to != address(0),
            "IBERejectableSBT: token is not transferable"
        );

        _states[tokenId] = State.Cancelled;
        _transferableOwners[tokenId] = address(0);

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
            _deadlinePrivateKey[tokenId] > block.timestamp,
            "IBERejectableSBT: deadline expired"
        );
        require(
            _states[tokenId] == State.Accepted,
            "IBERejectableSBT: token is not in accepted state"
        );

        messageData[tokenId].privateKey_x = privateKey_x;
        messageData[tokenId].privateKey_y = privateKey_y;

        emit PrivateKeySent(tokenId, privateKey_x, privateKey_y);
    }

    function getDeadlineAccept(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {
        require(_exists(tokenId), "IBERejectableSBT: token does not exist");
        return _deadlineAccept[tokenId];
    }

    function getDeadlinePrivateKey(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {
        require(_exists(tokenId), "IBERejectableSBT: token does not exist");
        return _deadlinePrivateKey[tokenId];
    }

    function getState(uint256 tokenId) public view virtual returns (State) {
        _requireMinted(tokenId);
        if (_states[tokenId] == State.Rejected) {
            return State.Rejected;
        } else if (_states[tokenId] == State.Cancelled) {
            return State.Cancelled;
        } else if (_states[tokenId] == State.Accepted) {
            if (
                keccak256(
                    abi.encodePacked((messageData[tokenId].privateKey_x))
                ) != keccak256(abi.encodePacked(("")))
            ) {
                return State.PrivateKeySent;
            } else {
                if (_deadlinePrivateKey[tokenId] < block.timestamp) {
                    return State.ExpiredPrivateKey;
                } else {
                    return State.Accepted;
                }
            }
        } else if (_deadlineAccept[tokenId] < block.timestamp) {
            return State.ExpiredAccept;
        }
        return State.Minted;
    }

    event PrivateKeySent(
        uint256 tokenId,
        bytes privateKey_x,
        bytes privateKey_y
    );
}
