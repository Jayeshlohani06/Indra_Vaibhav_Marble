
package com.indravaibhavmarble.permission.repository;

import com.indravaibhavmarble.permission.entity.Permission;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository
        extends JpaRepository<Permission, Long> {

    Optional<Permission> findByCode(String code);
}
