import z from 'zod';

const updateProfileSchema = z.object({
    body: z.object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        profession: z.string().max(200).optional(),
        fieldOfActivity: z.string().max(200).optional(),
        city: z.string().max(100).optional()
    })
});

export default { updateProfileSchema };
