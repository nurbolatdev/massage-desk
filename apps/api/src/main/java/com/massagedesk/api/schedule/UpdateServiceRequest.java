package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Partial update of a service. A missing or null field stays as is. */
public record UpdateServiceRequest(
        @Size(min = 1, max = 100) @Pattern(regexp = "[\\s\\S]*\\S[\\s\\S]*") String name,
        @Schema(description = "length in minutes, 5..480") @Min(5) @Max(480) Integer durationMin,
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal price,
        @Min(0) @Max(10000) Integer sortOrder,
        @Schema(description = "false hides the service from booking") Boolean active) {
}
