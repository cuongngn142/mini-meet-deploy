/**
 * Role Check Middleware
 * Kiểm tra quyền truy cập dựa trên role của user
 * Sử dụng: roleCheck('admin', 'teacher')
 */
const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).render('error', {
        error: 'Unauthorized',
        user: null
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).render('error', {
        error: 'Forbidden: Insufficient permissions',
        user: req.user
      });
    }

    next();
  };
};

module.exports = roleCheck;

