-- Fix update_company_member_role RPC - remove updated_at
CREATE OR REPLACE FUNCTION update_company_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id uuid;
  v_target_company_id uuid;
  v_current_user_role text;
  v_target_member_role text;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  
  -- Get target member's company
  SELECT company_id, role INTO v_target_company_id, v_target_member_role
  FROM company_members
  WHERE id = p_member_id;
  
  IF v_target_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;
  
  -- Check if current user is owner in that company
  SELECT role INTO v_current_user_role
  FROM company_members
  WHERE company_id = v_target_company_id
  AND user_id = v_current_user_id
  AND status = 'active';
  
  -- Only owner can change roles
  IF v_current_user_role != 'owner' THEN
    RETURN jsonb_build_object('error', 'Only owner can change member roles');
  END IF;
  
  -- Cannot change role of another owner
  IF v_target_member_role = 'owner' AND v_current_user_id != (
    SELECT user_id FROM company_members WHERE id = p_member_id
  ) THEN
    RETURN jsonb_build_object('error', 'Cannot change role of another owner');
  END IF;
  
  -- Update the role (without updated_at)
  UPDATE company_members
  SET role = p_role
  WHERE id = p_member_id;
  
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION update_company_member_role(uuid, text) TO authenticated;
