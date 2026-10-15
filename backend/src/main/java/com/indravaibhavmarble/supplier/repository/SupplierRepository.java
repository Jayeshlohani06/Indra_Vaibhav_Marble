
package com.indravaibhavmarble.supplier.repository;

import com.indravaibhavmarble.supplier.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    List<Supplier> findByActiveTrueOrderByNameAsc();

    Optional<Supplier> findByIdAndActiveTrue(Long id);

    boolean existsBySupplierCode(String supplierCode);

    Optional<Supplier> findBySupplierCode(String supplierCode);

    boolean existsByGstinIgnoreCase(String gstin);

    Optional<Supplier> findByGstinIgnoreCase(String gstin);
}
