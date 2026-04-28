export const validate = (schema) => async (req, res, next) => {
    const validation = await schema.safeParseAsync({
        body: req.body,
        params: req.params,
        query: req.query
    });

    if (!validation.success) {
        return res.error({error: validation.error.issues}, 400, 'Ошибка валидации данных')
    }

    req.validatedData = validation.data; 
    next();
};