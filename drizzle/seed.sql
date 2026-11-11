-- 初始管理员账号（本地部署首次初始化用）
INSERT INTO sys_user (username, password, name, role, status)
VALUES ('admin', 'admin123', '管理员', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;
