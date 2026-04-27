import express from "express";
import sendCodeToEmail from "../controllers/auth/send-code.controller.js";
import validate from "../middlewares/validate.middleware.js";
import authSchemas from "../schemas/auth.schema.js";

const router = express.Router();

router.post('/login', validate(authSchemas.emailSchema), sendCodeToEmail);

export default router;