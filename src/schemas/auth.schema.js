import z from "zod";

const emailSchema = z.object({
    body: z.object({
        email: z.email('Некорректный формат email')
    })
});

const verifyCodeSchema = z.object({
    body: z.object({
        email: z.email('Некорректный формат email'),
        code: z
            .string('Код обязателен для заполнения')
            .length(6, 'Код должен содержать 6 цифр')
            .regex(/^\d{6}$/, 'Код должен состоять из 6 цифр')
    })
});

export default { emailSchema, verifyCodeSchema };