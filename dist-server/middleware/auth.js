export const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_KEY || 'om_fixed_api_key_12345';
    if (!apiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing API key'
        });
        return;
    }
    if (apiKey !== expectedApiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
        });
        return;
    }
    next();
};
