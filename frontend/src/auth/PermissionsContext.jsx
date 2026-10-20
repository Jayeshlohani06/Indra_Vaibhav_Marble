import { createContext, useContext } from "react";

const PermissionsContext = createContext(new Set());

export function PermissionsProvider({ permissions, children }) {
  return (
    <PermissionsContext.Provider value={new Set(permissions || [])}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermission(permission) {
  const permissions = useContext(PermissionsContext);
  return permissions.has(permission);
}
