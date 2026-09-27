/*
# Lock down lp_is_admin() — revoke EXECUTE from anon
The lp_is_admin() function is used internally by RLS policies.
It should not be directly callable via the REST API.
*/
REVOKE EXECUTE ON FUNCTION lp_is_admin() FROM anon;
