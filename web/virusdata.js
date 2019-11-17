(function(){

    let lat, lng;

    const locationInput = $('#location');

    //algolia places messes with bootstrap invalid-feedback
    //a workaround is to add the 'is-invalid' class to an invisible input next to the feedback
    const locationFeedbackTrigger = $('#location_feedback_trigger');

    let locationValidityChanged = false;
    let makeLocationGreen = false;
    let isLocationValid = false;

    function validLocation() {
        isLocationValid = true;
        locationValidityChanged = true;
        locationInput.removeClass('is-invalid');
        locationFeedbackTrigger.removeClass('is-invalid');
        if (makeLocationGreen) {
            locationInput.addClass('is-valid');
        }
    }

    function invalidLocation() {
        isLocationValid = false;
        locationValidityChanged = true;
        locationInput.addClass('is-invalid');
        locationFeedbackTrigger.addClass('is-invalid');
        locationInput.removeClass('is-valid');
    }

    let mymap;

    const ageSlider = $('#age_slider').get(0);

    function main() {
        mymap = L.map('map').setView([37, -95], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mymap);

        places({
            appId: 'pl7YKVORTGD1',
            apiKey: 'a948aa7d345bccad873552a50ab0af74',
            container: locationInput.get(0),
            type: 'city',
            accessibility: {
                pinButton: {
                    class: 'unwanted_algolia_button'
                },
                clearButton: {
                    class: 'unwanted_algolia_button'
                }
            }
        }).on('change', e => {
            lat = e.suggestion.latlng.lat;
            lng = e.suggestion.latlng.lng;
            validLocation();
        });
        locationInput.on('input', () => {
            if (locationValidityChanged) {
                lat = undefined;
                lng = undefined;
                invalidLocation();
            }
        });
        locationInput.blur(() => {
            if (isNaN(lat)) {
                invalidLocation();
            }
        });

        noUiSlider.create(ageSlider, {
            start: [0, 110],
            connect: true,
            range: {
                min: 0,
                max: 110
            },
            step: 1,
            pips: {
                mode: 'count',
                values: 12
            }
        });

        const ageMin = $('#age_min');
        const ageMax = $('#age_max');
        const ageSliderInputs = [ageMin, ageMax];
        ageSlider.noUiSlider.on('update', (values, handle) => {
            ageSliderInputs[handle].val(parseInt(values[handle]).toString());
            if (handle === 0) {
                //minimum modified
                ageMax.attr('min', values[handle]);
            } else {
                //maximum modified
                ageMin.attr('max', values[handle]);
            }
        });
        ageMin.on('input', () => {
            const minVal = parseInt(ageMin.val());
            if (minVal > 0 && minVal <= 110) {
                ageSlider.noUiSlider.set([minVal, null])
            }
        });
        ageMin.change(() => {
            ageSlider.noUiSlider.set([ageMin.val(), null]);
        });
        ageMax.on('input', () => {
            const maxVal = parseInt(ageMax.val());
            if (maxVal > parseInt(ageMin.val()) && maxVal <= 110) {
                ageSlider.noUiSlider.set([null, maxVal]);
            }
        });
        ageMax.change(() => {
            ageSlider.noUiSlider.set([null, ageMax.val()]);
        });

        addAllDots();
    }

    async function addAllDots() {

        let submissions = await $.ajax({
            url: '/api/listdata',
            dataType: 'json'
        });
        for (let submission of submissions) {
            getLeafletColorIcon([submission.lat, submission.lng], getColorForSubmission(submission))
                .bindPopup(getPopupForSubmission(submission))
                .addTo(mymap);
        }

    }

    function getColorForSubmission(submission) {
        return '#ff0000';
    }

    $('#calculate_button').click(showStats);

    function getAbcd() {
        return {
            a: parseInt($('#num_a').val()),
            b: parseInt($('#num_b').val()),
            c: parseInt($('#num_c').val()),
            d: parseInt($('#num_d').val())
        };
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
        $('#expected_co_detect').text(expectedCoDetect.toFixed(2));

        $('#observed_co_detect').text(a);

        $('#fisher_p_val').text(calcFisherPVal(a, b, c, d, n));

        const chi2 = Math.pow(a - expectedCoDetect, 2) / expectedCoDetect;

        $('#chi2_p_val').text(pochisq(chi2, 1));

        $('#num_tests').text(n.toString());

        const oddsRatio = calcOR(a, b, c, d);
        $('#odds_ratio').text(oddsRatio.toFixed(2));

        $('#odds_ratio_95').text(calcORCIstring(a, b, c, d, oddsRatio));

        $('#stat_table').fadeIn(400);

    }

    $('#share_button').click(share);

    const institutionInput = $('#institution');
    const emailInput = $('#email');

    //odds ratio & 95% CI from
    //http://sphweb.bumc.bu.edu/otlt/MPH-Modules/PH717-QuantCore/PH717_ComparingFrequencies/PH717_ComparingFrequencies8.html
    function calcOR(a, b, c, d) {
        return (a * d) / (c * b);
    }

    function calcORCIstring(a, b, c, d, or) {
        const exponentPart = 1.96 * Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
        return (or * Math.pow(Math.E, -exponentPart)).toFixed(2) + ' - ' + (or * Math.pow(Math.E, exponentPart)).toFixed(2);
    }

    function getPopupForSubmission(submission) {
        const oddsRatio = calcOR(submission.a, submission.b, submission.c, submission.d);
        return L.popup({
            minWidth: 100
        }).setContent(`<table class="table-sm table-bordered table-striped">
<thead>
<tr>
    <th></th>
    <th>RV+</th>
    <th>RV-</th>
</tr>
</thead>
<tbody>
<tr>
    <th>Flu+</th>
    <td>${submission.a}</td>
    <td>${submission.b}</td>
</tr>
<tr>
    <th>Flu-</th>
    <td>${submission.c}</td>
    <td>${submission.d}</td>
</tr>
</tbody>
</table>
<p>
Odds Ratio: ${oddsRatio.toFixed(2)} <br>
Odds Ratio 95% CI: ${calcORCIstring(submission.a, submission.b, submission.c, submission.d, oddsRatio)} <br>
</p>`);
    }

    function share() {

        if (!institutionInput.val() || !emailInput.val() || !isLocationValid) {
            $('#share_form_normal_inputs').addClass('was-validated');
            makeLocationGreen = true;
            if (isLocationValid) {
                locationInput.addClass('is-valid');
            } else {
                invalidLocation();
            }
        } else {
            $('#share_form_normal_inputs').removeClass('was-validated');
            makeLocationGreen = false;
            locationInput.removeClass('is-valid');
            sendShareData();
        }

    }

    function sendShareData() {
        const obj = Object.assign({
            lat,
            lng,
            institution: institutionInput.val(),
            email: emailInput.val()
        }, getAbcd());
        $.ajax({
            url: '/api/share',
            type: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json'
        });
    }

    //https://en.wikipedia.org/wiki/Binomial_coefficient
    function nCr(n, r) {
        let out = bigInt.one;
        for (let i = n; i > n - r; i--) {
            out = out.multiply(i);
        }
        for (let i = 2; i <= r; i++) {
            out = out.divide(i);
        }
        return out;
    }

    function calcFisherPVal(a, b, c, d, n) {
        return (bigInt(Number.MAX_SAFE_INTEGER).multiply(nCr(a + b, a)).multiply(nCr(c + d, c)).divide(nCr(n, a + c)).toJSNumber()) / Number.MAX_SAFE_INTEGER;
    }

    const markerRadius = 8;
    const markerBorderSize = 1.5;

    function getLeafletColorIcon(latlng, color) {

        return L.marker(latlng, {
            icon: L.divIcon({
                className: '',
                html: getLeafletIconSvg(color),
                iconSize:    [markerRadius * 2, markerRadius * 2],
                iconAnchor:  [markerRadius, markerRadius],
                popupAnchor: [0, -markerRadius]
            })
        });

    }

    function getLeafletIconSvg(color) {
        return `<svg height="16" width="16">
  <circle cx="${markerRadius}" cy="${markerRadius}" r="${markerRadius - markerBorderSize / 2}" stroke="${color}" stroke-width="${markerBorderSize}" fill="${color}" />
</svg>`
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

    function poz(z) {
        var y, x, w;
        var Z_MAX = 6.0;              /* Maximum meaningful z value */

        if (z == 0.0) {
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


    var BIGX = 20.0;                  /* max value to represent exp(x) */

    function ex(x) {
        return (x < -BIGX) ? 0.0 : Math.exp(x);
    }

    /*  POCHISQ  --  probability of chi-square value

              Adapted from:
                      Hill, I. D. and Pike, M. C.  Algorithm 299
                      Collected Algorithms for the CACM 1967 p. 243
              Updated for rounding errors based on remark in
                      ACM TOMS June 1985, page 185
    */

    function pochisq(x, df) {
        var a, y, s;
        var e, c, z;
        var even;                     /* True if df is an even number */

        var LOG_SQRT_PI = 0.5723649429247000870717135; /* log(sqrt(pi)) */
        var I_SQRT_PI = 0.5641895835477562869480795;   /* 1 / sqrt(pi) */

        if (x <= 0.0 || df < 1) {
            return 1.0;
        }

        a = 0.5 * x;
        even = !(df & 1);
        if (df > 1) {
            y = ex(-a);
        }
        s = (even ? y : (2.0 * poz(-Math.sqrt(x))));
        if (df > 2) {
            x = 0.5 * (df - 1.0);
            z = (even ? 1.0 : 0.5);
            if (a > BIGX) {
                e = (even ? 0.0 : LOG_SQRT_PI);
                c = Math.log(a);
                while (z <= x) {
                    e = Math.log(z) + e;
                    s += ex(c * z - a - e);
                    z += 1.0;
                }
                return s;
            } else {
                e = (even ? 1.0 : (I_SQRT_PI / Math.sqrt(a)));
                c = 0.0;
                while (z <= x) {
                    e = e * (a / z);
                    c = c + e;
                    z += 1.0;
                }
                return c * y + s;
            }
        } else {
            return s;
        }
    }

    main();

})();