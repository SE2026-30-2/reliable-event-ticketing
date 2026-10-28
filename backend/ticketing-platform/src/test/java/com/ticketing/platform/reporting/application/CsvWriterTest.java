package com.ticketing.platform.reporting.application;

import org.junit.jupiter.api.Test;

import java.io.StringWriter;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvWriterTest {

    private static String render(List<?> row) throws Exception {
        StringWriter sw = new StringWriter();
        new CsvWriter(sw).row(row);
        return sw.toString();
    }

    @Test
    void startsWithABomSoExcelReadsVietnameseAsUtf8() throws Exception {
        assertThat(render(List.of("Nguyễn Văn A"))).startsWith("﻿").contains("Nguyễn Văn A");
    }

    @Test
    void quotesCommasQuotesAndNewlines() {
        assertThat(CsvWriter.escape("a,b")).isEqualTo("\"a,b\"");
        assertThat(CsvWriter.escape("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(CsvWriter.escape("line1\nline2")).isEqualTo("\"line1\nline2\"");
        assertThat(CsvWriter.escape("plain")).isEqualTo("plain");
    }

    @Test
    void neutralisesSpreadsheetFormulaInjectionInBuyerControlledText() {
        assertThat(CsvWriter.escape("=HYPERLINK(\"http://evil\")")).startsWith("\"'=HYPERLINK");
        assertThat(CsvWriter.escape("+1+1")).isEqualTo("'+1+1");
        assertThat(CsvWriter.escape("-2+3")).isEqualTo("'-2+3");
        assertThat(CsvWriter.escape("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(CsvWriter.escape("\tcmd")).startsWith("'");
    }

    @Test
    void realNegativeNumbersStayNumbersButNegativeLookingTextIsDefused() {
        assertThat(CsvWriter.escape(-5000L)).isEqualTo("-5000");
        assertThat(CsvWriter.escape("-5000")).isEqualTo("'-5000"); // it is text from a buyer, not our number
    }

    @Test
    void nullsAreEmptyAndRowsEndWithCrLf() throws Exception {
        assertThat(render(Arrays.asList("a", null, 3))).isEqualTo("﻿a,,3\r\n");
    }
}
