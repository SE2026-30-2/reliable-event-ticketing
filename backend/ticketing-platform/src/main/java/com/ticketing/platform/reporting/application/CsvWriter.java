package com.ticketing.platform.reporting.application;

import java.io.IOException;
import java.io.Writer;
import java.util.List;

/**
 * Minimal RFC 4180 CSV with one extra duty: spreadsheet formula injection. Holder names and emails
 * are buyer-controlled, and a cell starting with {@code = + - @} (or a tab/CR) is executed as a
 * formula when an organizer opens the export in Excel/Sheets - so such cells are prefixed with an
 * apostrophe, which spreadsheets treat as "text". A UTF-8 BOM is written first so Excel shows
 * Vietnamese names correctly.
 */
public final class CsvWriter {

    private final Writer out;

    public CsvWriter(Writer out) throws IOException {
        this.out = out;
        out.write('\uFEFF');
    }

    public void row(List<?> cells) throws IOException {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                out.write(',');
            }
            out.write(escape(cells.get(i)));
        }
        out.write("\r\n");
    }

    static String escape(Object cell) {
        if (cell == null) {
            return "";
        }
        String s = String.valueOf(cell);
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0 && !isPlainNumber(cell, s)) {
            s = "'" + s;
        }
        boolean needsQuotes = s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0;
        return needsQuotes ? '"' + s.replace("\"", "\"\"") + '"' : s;
    }

    /** A genuine negative number we computed (e.g. -5000 for a refund) must stay a number, not become text. */
    private static boolean isPlainNumber(Object cell, String s) {
        return cell instanceof Number && s.matches("-?\\d+(\\.\\d+)?");
    }
}
