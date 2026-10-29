package com.techie.microservices.ticketing.payment.infrastructure.vnpay;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Expected hashes were computed independently with Python's hmac/hashlib/urllib (not by this code). */
class VnpaySignerTest {

    private final VnpaySigner signer = new VnpaySigner("TESTSECRET");

    private final Map<String, String> params = Map.of(
            "vnp_Amount", "1000000", "vnp_Command", "pay", "vnp_OrderInfo", "Thanh toan ve abc",
            "vnp_TxnRef", "abc123", "vnp_Empty", "", "vnp_ReturnUrl", "http://localhost:5173/payment/result");

    @Test
    void canonicalQueryIsSortedEncodedAndDropsEmptyValues() {
        assertThat(VnpaySigner.canonicalQuery(params)).isEqualTo(
                "vnp_Amount=1000000&vnp_Command=pay&vnp_OrderInfo=Thanh+toan+ve+abc"
                        + "&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A5173%2Fpayment%2Fresult&vnp_TxnRef=abc123");
    }

    @Test
    void queryHashMatchesIndependentComputation() {
        assertThat(signer.signQuery(params)).isEqualTo(
                "1a407d047d1257c8d3e3037ec56d62a673cfba622a701aba8ded5c1b2223483920fdd0fc5435fc7ecb335b3f8f4331a7ee1d82daaca30033d32d92d1852676f2");
    }

    @Test
    void hashFieldsThemselvesAreExcludedFromTheSignedString() {
        var withHash = new java.util.HashMap<>(params);
        withHash.put("vnp_SecureHash", "whatever");
        withHash.put("vnp_SecureHashType", "HmacSHA512");
        assertThat(signer.signQuery(withHash)).isEqualTo(signer.signQuery(params));
    }

    @Test
    void verifyAcceptsGoodHashAnyCaseAndRejectsTamperingAndMissing() {
        String good = signer.signQuery(params);
        assertThat(signer.verifyQuery(params, good)).isTrue();
        assertThat(signer.verifyQuery(params, good.toUpperCase())).isTrue();
        var tampered = new java.util.HashMap<>(params);
        tampered.put("vnp_Amount", "1");
        assertThat(signer.verifyQuery(tampered, good)).isFalse();
        assertThat(signer.verifyQuery(params, null)).isFalse();
        assertThat(new VnpaySigner("OTHER").verifyQuery(params, good)).isFalse();
    }

    @Test
    void pipeHashMatchesIndependentComputationAndTreatsMissingAsEmpty() {
        List<String> fields = List.of("vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef",
                "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo");
        Map<String, String> v = Map.of("vnp_RequestId", "r1", "vnp_Version", "2.1.0", "vnp_Command", "querydr",
                "vnp_TmnCode", "TMN", "vnp_TxnRef", "ref1", "vnp_TransactionDate", "20260101101010",
                "vnp_CreateDate", "20260101101111", "vnp_IpAddr", "127.0.0.1", "vnp_OrderInfo", "info");
        assertThat(VnpaySigner.pipeData(v, fields)).isEqualTo("r1|2.1.0|querydr|TMN|ref1|20260101101010|20260101101111|127.0.0.1|info");
        assertThat(signer.signPipe(v, fields)).isEqualTo(
                "3d223ad0f837098972200d62fd2714f5f58b72642c724f2c5ffefd5b36085ef1801c09986aedf68ad0b587cb8d54a6c13095403dac0e09f4a50d419c9c2a7f41");
        assertThat(VnpaySigner.pipeData(Map.of("a", "x"), List.of("a", "b", "c"))).isEqualTo("x||");
    }
}
