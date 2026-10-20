INSERT INTO roles (name, description)
VALUES
    ('INVENTORY_MANAGER', 'Inventory and stock operations'),
    ('VIEWER', 'Read-only business access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'INVENTORY_MANAGER'
  AND p.code IN (
      'MASTER_DATA_READ',
      'MASTER_DATA_MANAGE',
      'PRODUCT_READ',
      'PRODUCT_MANAGE',
      'INVENTORY_READ',
      'INVENTORY_MANAGE',
      'SUPPLIER_READ',
      'PURCHASE_READ'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'VIEWER'
  AND p.code IN (
      'MASTER_DATA_READ',
      'PRODUCT_READ',
      'CUSTOMER_READ',
      'SUPPLIER_READ',
      'INVENTORY_READ',
      'PURCHASE_READ',
      'SALES_READ',
      'INVOICE_READ',
      'PAYMENT_READ',
      'REPORT_READ',
      'EXPENSE_READ'
  )
ON CONFLICT DO NOTHING;
