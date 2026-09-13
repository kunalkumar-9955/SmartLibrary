"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const Library_1 = require("../models/Library");
const response_1 = require("../utils/response");
const getSettings = async (req, res, next) => {
    try {
        let settings = await Library_1.Library.findOne();
        if (!settings) {
            settings = await Library_1.Library.create({
                name: 'Smart Library',
                address: '42 Knowledge Park, New Delhi',
                phone: '+91 9876543210',
                email: 'admin@smartlibrary.com',
                openingTime: '08:00 AM',
                closingTime: '10:00 PM',
                totalSeats: 50,
                qrExpirySeconds: 45,
            });
        }
        return (0, response_1.sendSuccess)(res, settings);
    }
    catch (error) {
        next(error);
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res, next) => {
    try {
        const { name, address, phone, email, openingTime, closingTime, qrExpirySeconds } = req.body;
        let settings = await Library_1.Library.findOne();
        if (!settings) {
            settings = new Library_1.Library();
        }
        if (name)
            settings.name = name;
        if (address)
            settings.address = address;
        if (phone)
            settings.phone = phone;
        if (email)
            settings.email = email;
        if (openingTime)
            settings.openingTime = openingTime;
        if (closingTime)
            settings.closingTime = closingTime;
        if (qrExpirySeconds)
            settings.qrExpirySeconds = qrExpirySeconds;
        settings.totalSeats = 50; // Always 50 seats for this library
        await settings.save();
        return (0, response_1.sendSuccess)(res, settings, 'Library settings updated successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettings = updateSettings;
