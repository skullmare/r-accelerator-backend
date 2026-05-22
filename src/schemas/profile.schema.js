import z from 'zod';

const updateProfileSchema = z.object({
    body: z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        profession: z.string().min(1).max(200).optional(),
        fieldOfActivity: z.string().min(1).max(200).optional(),
        city: z.string().min(1).max(100).optional()
    })
});

export default { updateProfileSchema };
