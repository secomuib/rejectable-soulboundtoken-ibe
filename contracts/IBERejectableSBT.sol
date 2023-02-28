// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./SBT/RejectableSBT.sol";

/// @title Test SBT with IBE parameters
/// @notice Soulbound token test contract
contract IBERejectableSBT is RejectableSBT {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // address of the middleware which will send the private key
    address public middleware;

    struct MessageData {
        // identity of the receiver
        address idReceiver;
        uint256 idTimestamp;
        // deadline
        uint256 deadline;
        // hash of the message
        bytes messageHash;
        // hash of the cipher of the message, encrypted with the identity of the receiver
        bytes cipherHash;
        // private key to decrypt the cipher
        bytes privateKey_x;
        bytes privateKey_y;
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
    ) RejectableSBT(name_, symbol_) {
        middleware = middleware_;

        fieldOrder = fieldOrder_;
        subgroupOrder = subgroupOrder_;
        pointP_x = pointP_x_;
        pointP_y = pointP_y_;
        pointPpublic_x = pointPpublic_x_;
        pointPpublic_y = pointPpublic_y_;
    }

    function mint(
        address to,
        uint256 timestamp,
        uint256 deadline,
        bytes memory messageHash,
        bytes memory cipherHash
    ) public returns (uint256) {
        require(to != address(0), "RejectableSBT: mint to the zero address");
        require(deadline > block.timestamp, "RejectableSBT: deadline expired");
        require(
            keccak256(abi.encodePacked((messageHash))) !=
                keccak256(abi.encodePacked((""))),
            "RejectableSBT: message hash is empty"
        );
        require(
            keccak256(abi.encodePacked((cipherHash))) !=
                keccak256(abi.encodePacked((""))),
            "RejectableSBT: cipher hash is empty"
        );

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(to, tokenId);

        messageData[tokenId] = MessageData({
            idReceiver: to,
            idTimestamp: timestamp,
            deadline: deadline,
            messageHash: messageHash,
            cipherHash: cipherHash,
            privateKey_x: "",
            privateKey_y: ""
        });

        return tokenId;
    }

    function sendPrivateKey(
        uint256 tokenId,
        bytes memory privateKey_x,
        bytes memory privateKey_y
    ) public {
        require(
            _msgSender() == middleware,
            "RejectableSBT: caller is not the middleware"
        );
        require(_exists(tokenId), "RejectableSBT: token does not exist");
        require(
            keccak256(abi.encodePacked((messageData[tokenId].privateKey_x))) ==
                keccak256(abi.encodePacked((""))),
            "RejectableSBT: private key already sent"
        );
        require(
            keccak256(abi.encodePacked((messageData[tokenId].privateKey_y))) ==
                keccak256(abi.encodePacked((""))),
            "RejectableSBT: private key already sent"
        );

        messageData[tokenId].privateKey_x = privateKey_x;
        messageData[tokenId].privateKey_y = privateKey_y;

        emit PrivateKeySent(tokenId, privateKey_x, privateKey_y);
    }

    /* function getState(uint256 tokenId) public pure returns (string memory) {
    } */

    event PrivateKeySent(
        uint256 tokenId,
        bytes privateKey_x,
        bytes privateKey_y
    );
}
