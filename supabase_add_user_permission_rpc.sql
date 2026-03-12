-- RPC function to set user permissions (bypasses RLS)
-- Allows admin/owner to set custom permissions for company members

CREATE OR REPLACE FUNCTION set_user_permission(
  p_user_id uuid,
  p_tab_id text,
  p_allowed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id uuid;
  v_target_company_id uuid;
  v_current_user_company uuid;
  v_current_user_role text;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  
  -- Check if current user is admin/owner in the same company as target user
  -- First, find which company the target user belongs to
  SELECT cm.company_id, cm.role INTO v_target_company_id, v_current_user_role
  FROM company_members cm
  WHERE cm.user_id = p_user_id
  AND cm.status = 'active'
  ORDER BY cm.created_at DESC
  LIMIT 1;
  
  IF v_target_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Target user is not a member of any company');
  END IF;
  
  -- Check if current user is admin/owner in that company
  SELECT role INTO v_current_user_role
  FROM company_members
  WHERE company_id = v_target_company_id
  AND user_id = v_current_user_id
  AND status = 'active';
  
  IF v_current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('error', 'Only owner or admin can set permissions');
  END IF;
  
  -- Insert or update permission
  INSERT INTO user_permissions (user_id, tab_id, allowed)
  VALUES (p_user_id, p_tab_id, p_allowed)
  ON CONFLICT (user_id, tab_id)
  DO UPDATE SET 
    allowed = p_allowed,
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION set_user_permission(uuid, text, boolean) TO authenticated;

-- Also create function to remove permission
CREATE OR REPLACE FUNCTION remove_user_permission(
  p_user_id uuid,
  p_tab_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id uuid;
  v_target_company_id uuid;
  v_current_user_role text;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  
  -- Find target user's company
  SELECT company_id INTO v_target_company_id
  FROM company_members
  WHERE user_id = p_user_id
  AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_target_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Target user not found');
  END IF;
  
  -- Check permissions
  SELECT role INTO v_current_user_role
  FROM company_members
  WHERE company_id = v_target_company_id
  AND user_id = v_current_user_id
  AND status = 'active';
  
  IF v_current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('error', 'Only owner or admin can remove permissions');
  END IF;
  
  DELETE FROM user_permissions
  WHERE user_id = p_user_id AND tab_id = p_tab_id;
  
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION remove_user_permission(uuid, text) TO authenticated;
