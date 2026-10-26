
package com.indravaibhavmarble.purchase.service;

import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Component;

@Component
public class PurchaseNumberGenerator {

    private final EntityManager entityManager;

    public PurchaseNumberGenerator(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Returns the next purchase number, e.g. PUR-0017. */
    public String generate() {
        Number next = (Number) entityManager
                .createNativeQuery("SELECT nextval('purchase_number_seq')")
                .getSingleResult();

        return String.format("PUR-%04d", next.longValue());
    }
}
