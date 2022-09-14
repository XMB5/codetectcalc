(function(){
    $('#calculate_button').click(showStats);

    function getAbcd() {
        return {
            a: parseInt($('#num_a').val()),
            b: parseInt($('#num_b').val()),
            c: parseInt($('#num_c').val()),
            d: parseInt($('#num_d').val())
        };
    }

    function formatNumber(x) {
        if (1e-3 <= x && x <= 1) {
            return x.toFixed(3);
        } else if (x > 1 && x < 1e4) {
            return x.toPrecision(5);
        } else {
            //less than 1e-3 or greater than 1e4
            return x.toExponential(3);
        }
    }

    function showStats() {

        const {a, b, c, d} = getAbcd();

        if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) {
            $('#data_form').addClass('was-validated');
            return;
        }

        $('#data_form').removeClass('was-validated');

        const n = a + b + c + d;

        const expectedCoDetect = ((a + c) / n) * ((a + b) / n) * n;
        $('#expected_co_detect').text(formatNumber(expectedCoDetect));

        $('#observed_co_detect').text(a);

        const useFisherPVal = shouldUseFisherPVal(a,  b, c, d, n);

        $('#fisher_row').toggleClass('noshow', !useFisherPVal);
        $('#chi2_row').toggleClass('noshow', useFisherPVal);

        if (useFisherPVal) {
            $('#fisher_p_val').text(formatNumber(calcFisherPVal(a, b, c, d, n)));
        } else {
            const chi2 = Math.pow(a - expectedCoDetect, 2) / expectedCoDetect;
            console.log(chi2);
            $('#chi2_p_val').text(getFormattedChi2PVal(chi2));
        }

        $('#num_tests').text(n.toString());

        const orInfo = calcOR(a, b, c, d);
        $('#odds_ratio').text(formatNumber(orInfo.oddsRatio));
        $('.haldane_correction').toggleClass('noshow', !orInfo.haldaneCorrection);

        $('#odds_ratio_95').text(calcORCIstring(a, b, c, d, orInfo));

        $('#stat_display, #share').fadeIn(400);

    }

    //odds ratio & 95% CI from
    //http://sphweb.bumc.bu.edu/otlt/MPH-Modules/PH717-QuantCore/PH717_ComparingFrequencies/PH717_ComparingFrequencies8.html
    function calcOR(a, b, c, d) {
        const out = {};
        out.haldaneCorrection = a === 0 || b === 0 || c === 0 || d === 0;
        if (out.haldaneCorrection) {
            out.oddsRatio = ((a + 0.5) * (d + 0.5)) / ((c + 0.5) * (b + 0.5));
        } else {
            out.oddsRatio = (a * d) / (c * b);
        }
        return out;
    }

    function calcORCIstring(a, b, c, d, orInfo) {
        const radicand = orInfo.haldaneCorrection ? (1/(a + 0.5) + 1/(b + 0.5) + 1/(c + 0.5) + 1/(d + 0.5)) : 1 / a + 1 / b + 1 / c + 1 / d;
        const exponentPart = 1.96 * Math.sqrt(radicand);
        return formatNumber(orInfo.oddsRatio * Math.pow(Math.E, -exponentPart)) + ' - ' + formatNumber(orInfo.oddsRatio * Math.pow(Math.E, exponentPart));
    }

    //https://en.wikipedia.org/wiki/Binomial_coefficient
    function nCr(n, r) {
        let out = 1n;
        for (let i = 0; i < r; i++) {
            out *= BigInt(n - i);
        }
        for (let i = 2; i <= r; i++) {
            out /= BigInt(i);
        }
        return out;
    }

    function calcFisherPVal(a, b, c, d, n) {
        return Number(BigInt(Number.MAX_SAFE_INTEGER) * nCr(a + b, a) * nCr(c + d, c) / nCr(n, a + c)) / Number.MAX_SAFE_INTEGER;
    }

    function shouldUseFisherPVal(a, b, c, d, n) {
        //use fisher pval if any expected value is < 5
        const rowCols = [[a + b, a + c], [a + b, b + d], [c + d, a + c], [c + d, b + d]];
        for (let rowCol of rowCols) {
            if (rowCol[0] * rowCol[1] / n < 5) {
                return true;
            }
        }
        return false;
    }

    function getFormattedChi2PVal(chi2) {
        //assumes 1 degree of freedom
        const pval = pochisqDF1(chi2);
        if (pval === 0) {
            //pochisqDF1(35.999999) returns 1.9710012510998354e-9
            //pochisqDF1(36) returns 0
            return 'less than 2e-9'
        } else {
            return formatNumber(pval);
        }
    }

    //following 2 stat functions from https://web.archive.org/web/20120712105035/https://www.swogstat.org/stat/public/chisq_calculator.htm

    /*  The following JavaScript functions for calculating normal and
    chi-square probabilities and critical values were adapted by
    John Walker from C implementations
    written by Gary Perlman of Wang Institute, Tyngsboro, MA
    01879.  Both the original C code and this JavaScript edition
    are in the public domain.  */

    /*  POZ  --  probability of normal z value

        Adapted from a polynomial approximation in:
                Ibbetson D, Algorithm 209
                Collected Algorithms of the CACM 1963 p. 616
        Note:
                This routine has six digit accuracy, so it is only useful for absolute
                z values < 6.  For z values >= to 6.0, poz() returns 0.0.
    */

    const Z_MAX = 6.0;              /* Maximum meaningful z value */

    function poz(z) {
        let y, x, w;

        if (z === 0.0) {
            x = 0.0;
        } else {
            y = 0.5 * Math.abs(z);
            if (y >= (Z_MAX * 0.5)) {
                x = 1.0;
            } else if (y < 1.0) {
                w = y * y;
                x = ((((((((0.000124818987 * w
                    - 0.001075204047) * w + 0.005198775019) * w
                    - 0.019198292004) * w + 0.059054035642) * w
                    - 0.151968751364) * w + 0.319152932694) * w
                    - 0.531923007300) * w + 0.797884560593) * y * 2.0;
            } else {
                y -= 2.0;
                x = (((((((((((((-0.000045255659 * y
                    + 0.000152529290) * y - 0.000019538132) * y
                    - 0.000676904986) * y + 0.001390604284) * y
                    - 0.000794620820) * y - 0.002034254874) * y
                    + 0.006549791214) * y - 0.010557625006) * y
                    + 0.011630447319) * y - 0.009279453341) * y
                    + 0.005353579108) * y - 0.002141268741) * y
                    + 0.000535310849) * y + 0.999936657524;
            }
        }
        return z > 0.0 ? ((x + 1.0) * 0.5) : ((1.0 - x) * 0.5);
    }

    /*  POCHISQ  --  probability of chi-square value

              Adapted from:
                      Hill, I. D. and Pike, M. C.  Algorithm 299
                      Collected Algorithms for the CACM 1967 p. 243
              Updated for rounding errors based on remark in
                      ACM TOMS June 1985, page 185

              Modified to only support 1 degree of freedom
    */

    function pochisqDF1(x) {
        return 2.0 * poz(-Math.sqrt(x));
    }

})();