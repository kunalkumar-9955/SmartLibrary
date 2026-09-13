import { Request, Response, NextFunction } from 'express';
import { Notice } from '../models/Notice';
import { sendSuccess, sendError } from '../utils/response';

export const getNotices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    return sendSuccess(res, notices);
  } catch (error) {
    next(error);
  }
};

export const createNotice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return sendError(res, 'Title and description are required', 400);
    }

    const notice = await Notice.create({
      title: title.trim(),
      description: description.trim(),
    });

    return sendSuccess(res, notice, 'Notice published successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteNotice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByIdAndDelete(id);
    if (!notice) {
      return sendError(res, 'Notice not found', 404);
    }
    return sendSuccess(res, null, 'Notice deleted');
  } catch (error) {
    next(error);
  }
};
