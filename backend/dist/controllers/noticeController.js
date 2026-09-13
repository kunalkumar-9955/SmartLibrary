"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotice = exports.createNotice = exports.getNotices = void 0;
const Notice_1 = require("../models/Notice");
const response_1 = require("../utils/response");
const getNotices = async (req, res, next) => {
    try {
        const notices = await Notice_1.Notice.find().sort({ createdAt: -1 });
        return (0, response_1.sendSuccess)(res, notices);
    }
    catch (error) {
        next(error);
    }
};
exports.getNotices = getNotices;
const createNotice = async (req, res, next) => {
    try {
        const { title, description } = req.body;
        if (!title || !description) {
            return (0, response_1.sendError)(res, 'Title and description are required', 400);
        }
        const notice = await Notice_1.Notice.create({
            title: title.trim(),
            description: description.trim(),
        });
        return (0, response_1.sendSuccess)(res, notice, 'Notice published successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createNotice = createNotice;
const deleteNotice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const notice = await Notice_1.Notice.findByIdAndDelete(id);
        if (!notice) {
            return (0, response_1.sendError)(res, 'Notice not found', 404);
        }
        return (0, response_1.sendSuccess)(res, null, 'Notice deleted');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNotice = deleteNotice;
