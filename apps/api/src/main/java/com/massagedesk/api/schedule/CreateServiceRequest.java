package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** A new service. Without a sort order it is appended after the last one. */
public record CreateServiceRequest(
        @NotBlank @Size(max = 100) String name,
        @Schema(description = "length in minutes, 5..480") @NotNull @Min(5) @Max(480) Integer durationMin,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal price,
        @Schema(description = "display order; omitted means last") @Min(0) @Max(10000) Integer sortOrder) {
}
