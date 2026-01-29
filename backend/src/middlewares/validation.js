// Validation middleware placeholder
// Will be populated with express-validator rules as needed

export const validateRequest = (validations) => {
  return async (req, res, next) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const { validationResult } = await import('express-validator');
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  };
};
