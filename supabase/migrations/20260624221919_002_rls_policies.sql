-- RLS Policies for Multi-Tenant Isolation
-- Using public schema helper functions for tenant isolation

-- Helper function to get user's tenant
CREATE OR REPLACE FUNCTION current_user_tenant_id() RETURNS TEXT AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_current_user_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::TEXT
    AND role = 'SUPER_ADMIN'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Tenants
CREATE POLICY "select_tenants_policy" ON tenants
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR id = current_user_tenant_id());

CREATE POLICY "update_tenants_policy" ON tenants
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR id = current_user_tenant_id());

-- Users
CREATE POLICY "select_users_policy" ON users
  FOR SELECT TO authenticated
  USING (
    is_current_user_super_admin() 
    OR tenant_id = current_user_tenant_id() 
    OR id = auth.uid()::TEXT
  );

CREATE POLICY "update_users_policy" ON users
  FOR UPDATE TO authenticated
  USING (
    is_current_user_super_admin() 
    OR (tenant_id = current_user_tenant_id() AND id = auth.uid()::TEXT)
  );

CREATE POLICY "insert_users_policy" ON users
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "delete_users_policy" ON users
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Sessions
CREATE POLICY "select_sessions_policy" ON sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY "delete_sessions_policy" ON sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::TEXT);

-- Stores
CREATE POLICY "select_own_stores" ON stores
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_stores" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_stores" ON stores
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_stores" ON stores
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Categories
CREATE POLICY "select_own_categories" ON categories
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_categories" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_categories" ON categories
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_categories" ON categories
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Products
CREATE POLICY "select_own_products" ON products
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_products" ON products
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_products" ON products
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Inventory
CREATE POLICY "select_own_inventory" ON inventory
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_inventory" ON inventory
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_inventory" ON inventory
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_inventory" ON inventory
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Stock Movements
CREATE POLICY "select_own_movements" ON stock_movements
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_movements" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Customers
CREATE POLICY "select_own_customers" ON customers
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_customers" ON customers
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_customers" ON customers
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Suppliers
CREATE POLICY "select_own_suppliers" ON suppliers
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_suppliers" ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_suppliers" ON suppliers
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_suppliers" ON suppliers
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Supplier Orders
CREATE POLICY "select_own_supplier_orders" ON supplier_orders
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_supplier_orders" ON supplier_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_supplier_orders" ON supplier_orders
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_supplier_orders" ON supplier_orders
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Sales
CREATE POLICY "select_own_sales" ON sales
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_sales" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_sales" ON sales
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "delete_own_sales" ON sales
  FOR DELETE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Alerts
CREATE POLICY "select_own_alerts" ON alerts
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_alerts" ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_alerts" ON alerts
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Notifications
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::TEXT OR is_current_user_super_admin());

CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::TEXT);

-- Tenant Settings
CREATE POLICY "select_own_settings" ON tenant_settings
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_settings" ON tenant_settings
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Subscriptions
CREATE POLICY "select_own_subscriptions" ON subscriptions
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Cash Registers
CREATE POLICY "select_own_cash_registers" ON cash_registers
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_cash_registers" ON cash_registers
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_cash_registers" ON cash_registers
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Credits
CREATE POLICY "select_own_credits" ON credits
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_credits" ON credits
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_credits" ON credits
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Quotes
CREATE POLICY "select_own_quotes" ON quotes
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_quotes" ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_quotes" ON quotes
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Invoices
CREATE POLICY "select_own_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "insert_own_invoices" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY "update_own_invoices" ON invoices
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id());

-- Audit Logs
CREATE POLICY "select_own_audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR tenant_id = current_user_tenant_id() OR user_id = auth.uid()::TEXT);
