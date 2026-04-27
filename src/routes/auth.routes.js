import express from "express";
import sendCodeToEmail from "../controllers/auth/send-code.controller.js";
import verificationCode from "../controllers/auth/verify-code.controller.js";
import validate from "../middlewares/validate.middleware.js";
import authSchemas from "../schemas/auth.schema.js";

const router = express.Router();

router.post('/login', validate(authSchemas.emailSchema), sendCodeToEmail);
router.post('/verify', validate(authSchemas.verifyCodeSchema), verificationCode);

export default router;