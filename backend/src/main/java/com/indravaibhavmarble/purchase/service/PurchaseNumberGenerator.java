
package com.indravaibhavmarble.purchase.service;

import com.indravaibhavmarble.common.time.BusinessDate;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Component
public class PurchaseNumberGenerator {

    public String generate() {
        String date = BusinessDate.today()
                .format(DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 8)
                .toUpperCase();

        return "PUR-" + date + "-" + suffix;
    }
}
