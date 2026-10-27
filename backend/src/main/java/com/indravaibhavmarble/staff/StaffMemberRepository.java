package com.indravaibhavmarble.staff;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffMemberRepository extends JpaRepository<StaffMember, Long> {

    List<StaffMember> findAllByOrderByActiveDescNameAsc();

    Optional<StaffMember> findByNameIgnoreCase(String name);

    Optional<StaffMember> findByIdAndActiveTrue(Long id);
}
