// future proof
var fileProcessFunctions = {
    csv: function(d, i, columns) {
        return d;
    },

    tsv: function(d, i, columns) {
        return d;
    }
};

var saveFileData = function(error, data) {
    if (error) throw error;
};

var dataContainer, r;


var allFileData = [{
        /*
            Data source.
            Universal service providers (USP) under direct or indirect designation - access points
            https://data.europa.eu/euodp/en/data/dataset/post_acc_1
        */
        path: "index.tsv",
        readAsType: "text", // set as text to read it as text
        processFunction: function(error, data) {


            // clean up the data
            data = (data.slice(0, 17) + data.slice(18, data.length)); // Remove character geo\time to geotime
            data = replaceAll(data, ",", "\t");
            data = replaceAll(data, ":", "");
            data = replaceAll(data, " ", ""); // seems like spaces are not used in this data, so remove them all.
            //data = data.replace(/ +/g, "");
            data = d3.tsvParse(data);
            if (data != null && data != undefined) {
                // saveFileData(null, data);

                // Check for year dates in the objects and group them under years.
                var dataContainer = {};

                var yearsThatAreAdded = {};

                dataContainer.years = [];
                dataContainer.data = data;

                this.convertedData = dataContainer; // fails to work. Applies the data to the window and not to this object!!!


                // Calculate max size per year.
                var sizesPerYear = {};


                // for (var i = 0; i < dataContainer.years.length; i++) {
                //     sizesPerYear[dataContainer.years[i]] = [];
                // }


                // process the main data
                for (var i = data.length - 1; i >= 0; i--) { // invert loop required for removing items
                    var item = data[i];
                    item.index = i; // debug

                    var yearData = {};
                    var doesItemHaveYearValues = false;
                    for (var prop in item) {
                        if (!isNaN(Number(prop)) && !isNaN(Number(item[prop])) && Number(item[prop])) {

                            yearData[prop] = {
                                year: Number(prop),
                                value: Number(item[prop]),
                                index: i // debug
                            };

                            // register all years
                            if (!yearsThatAreAdded[prop]) {
                                yearsThatAreAdded[prop] = true;
                                dataContainer.years[dataContainer.years.length] = Number(prop);
                            }
                            if (!sizesPerYear[prop]) {
                                sizesPerYear[prop] = [];
                            }
                            sizesPerYear[prop][sizesPerYear[prop].length] = Number(item[prop]);

                            // delete old properties
                            delete item[prop];

                            // can I use this item?
                            doesItemHaveYearValues = true;
                        }
                    }

                    // remove useless items.
                    if (doesItemHaveYearValues) {



                        item.yearData = yearData;
                    } else {
                        data.splice(i, 1);
                    }

                }




                dataContainer.years.sort(function(a, b) {
                    return a > b;
                });


                var maxSizesPerYear = {};
                for (var prop in sizesPerYear) {
                    maxSizesPerYear[prop] = d3.max(sizesPerYear[prop]);
                }
                dataContainer.maxSizesPerYear = maxSizesPerYear;

                makeGraph();
            }
        }

    },

];








for (var i = 0; i < allFileData.length; i++) {
    var fileData = allFileData[i];
    if (fileExists(fileData.path)) {
        var processFunction = fileData.processFunction;
        if (fileData.readAsType == "text") {
            d3.text(fileData.path).get(processFunction);
        } else {
            d3[fileData.readAsType](fileData.path, processFunction, saveFileData);
        }

    } else {
        console.log("Can't find file:", fileData.path);
    }
}

var mouseEffects = {
    enter: function(d, index) {

        var year = dataContainer.selectedYear;

        // anti bug, removes the previous label
        if (dataContainer.lastCreatedTextGroupElement) {
            dataContainer.lastCreatedTextGroupElement.remove();
            dataContainer.lastCreatedTextGroupElement = null;
        }

        if (!this.parentElement.childNodes[1]) { // anti bug
            var textGroupElement = d3.select(this.parentElement).append("g").attr("class","always-on-top");
            textGroupElement.append("text")
                .attr("fill", "black")
                .attr("x", 350)
                .attr("y", function(d) {
                    var yearData = d.yearData;
                    if (yearData && yearData[year] && yearData[year].value) {
                        return (dataContainer.height / 2) + r(yearData[year].value) + 20;
                    }
                    return 0;
                })
                .attr("text-anchor", "middle")
                .attr("font-size", 40)
                .text((getCountryName(d.geotime) || d.geotime) + " - " + (d.yearData[year] ? d.yearData[year].value : ""));
            dataContainer.lastCreatedTextGroupElement = textGroupElement;
            // textGroupElement.append("text")
            //     .attr("fill", "black")
            //     .attr("x", 500)
            //     .attr("y", 500)
            //     .attr("text-anchor", "middle")
            //     .attr("font-size", 40)
            //     .text(d.geotime);
        }
    },
    leave: function() {
        // remove the label
        if (this.parentElement.childNodes[1]) { // anti bug
            this.parentElement.removeChild(this.parentElement.childNodes[1]);
        }
    },
    click: function() {

    },
};


var updateDataSet = function() {
    makeGraph(this.value);
};

var svg;

function makeGraph(year) { //selected years: [int/string year]

    // get the data source.
    dataContainer = this.convertedData;
    var data = dataContainer.data;



    var yearIndex = 0;
    if (year == undefined) {
        year = dataContainer.years[0];
    }
    dataContainer.selectedYear = year;


    // size
    dataContainer.width = 700;
    dataContainer.height = 700;


    // get the size of the largest circle
    var allSizes = [];
    for (var prop in dataContainer.maxSizesPerYear) {
        allSizes[allSizes.length] = dataContainer.maxSizesPerYear[prop];
    }

    var maxSize = d3.max(allSizes);
    //


    // replare the scale
    r = d3.scaleLinear()
        .rangeRound([0, dataContainer.height / 2]);

    r.domain([0, maxSize]);



    // animation
    var ringTransition = (d3.transition()
        .duration(500)
        .ease(d3.easeLinear));

    // sort the items.
    data.sort(function(a, b) {
        return (a.yearData[year] != undefined ? a.yearData[year].value : 0) < (b.yearData[year] != undefined ? b.yearData[year].value : 0);
    });

    var mainElement = d3.select("main");
    if (!svg) {


        svg = mainElement.append("svg")
            .attr("width", dataContainer.width)
            .attr("height", (dataContainer.height + 50))
            .attr("viewBox", "0,0," + dataContainer.width + "," + (dataContainer.height + 50));


        var circleGroup = svg.append("g");




        circleGroup.selectAll("g")
            .data(data)
            .enter()
            .append("g")
            .append("circle")
            .attr("r", function(d) {
                var yearData = d.yearData;
                if (yearData && yearData[year] && yearData[year].value) {
                    return r(yearData[year].value);
                }
                return 0;
            })
            .attr("stroke-width", 1)
            .attr("fill", "white")
            .attr("fill-opacity", 0)
            .attr("cx", dataContainer.width / 2)
            .attr("cy", dataContainer.height / 2)
            .on("click", mouseEffects.click)
            .on("mouseover", mouseEffects.enter)
            .on("mouseout", mouseEffects.leave);



        var form = mainElement.append("form");


        // add the date selection.
        var labels = form.selectAll("label")
            .data(dataContainer.years,
                function(d, i) { // solved skip first item problem: https://stackoverflow.com/questions/16544269/why-is-the-first-link-item-being-skipped
                    return d + i;
                })
                .enter()
                    .append("label")
                    .attr("for", function(d) {
                        return "show-" + d;
                    })
                    .html(function(d) {
                        return d;
                    });

        var inputs = form.selectAll("input")
                .data(dataContainer.years,
                    function(d, i) {
                        return d + i;
                    })
                    .enter()
                        .append("input")
                            .attr("id",  function(d) {
                                return "show-" + d;
                            })
                            .attr("type", "radio")
                            .attr("name", "year")
                            .attr("value", function(d) {
                                return d;
                            })
                            .on("click", updateDataSet);

        var formOfDom = document.querySelector('form');
        var inputsOfDom = document.querySelectorAll('input');
        var labelsOfDom = document.querySelectorAll('label');

        for (var i = 0; i < 4; i++) {
            formOfDom.insertBefore(inputsOfDom[i], labelsOfDom[i]);
        }


    } else {

        // update the circles
        svg.select("g").selectAll("circle")
            .transition(ringTransition)
            .attr("r", function(d) {
                var yearData = d.yearData;
                if (yearData && yearData[year] && yearData[year].value) {
                    return Math.ceil(r(yearData[year].value));
                }
                return 0;
            })
            .text(function(d) {
                return d.geotime;
            });


        // hard code element order adjustment... There is some things in d3 that get in my way.
        setTimeout(function() {
            var mainGroup = document.querySelector('svg > g');
            if (mainGroup) {
                var circleGroups = mainGroup.querySelectorAll('g');
                var collectSize = [];
                for (var i = 0; i < circleGroups.length; i++) {
                    var circleGroup = circleGroups[i];
                    var radius = circleGroup.childNodes[0].getAttribute("r");
                    collectSize[collectSize.length] = {
                        radius: Number(radius),
                        element: circleGroup
                    };
                }

                collectSize.sort(function(a, b) {
                    return (a.radius || 0) < (b.radius || 0);
                });

                for (var i = 0; i < collectSize.length; i++) {
                    document.querySelector('svg > g').appendChild(collectSize[i].element);
                }
            }
        }, 1000);

    }
}




// https://data.europa.eu/euodp/en/data/dataset/data_nationally-designated-areas-national-cdda/resource/c0ddf96d-20e9-4f7f-af09-80598cc7b673

// utility functions //

////////////////////////////////////
// Created by: Imortenson
// link https://stackoverflow.com/questions/15054182/javascript-check-if-file-exists
function fileExists(url) {
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status != 404;
}
////////////////////////////////////

// Created by: Cory Gross.
// Edited by: Peter Mortensen
// link https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
function replaceAll(theString, search, replacement) {
    return theString.replace(new RegExp(search, 'g'), replacement);
};


// Created by maephisto
// Link: https://gist.github.com/maephisto/9228207

var isoCountries = {
    'AF' : 'Afghanistan',
    'AX' : 'Aland Islands',
    'AL' : 'Albania',
    'DZ' : 'Algeria',
    'AS' : 'American Samoa',
    'AD' : 'Andorra',
    'AO' : 'Angola',
    'AI' : 'Anguilla',
    'AQ' : 'Antarctica',
    'AG' : 'Antigua And Barbuda',
    'AR' : 'Argentina',
    'AM' : 'Armenia',
    'AW' : 'Aruba',
    'AU' : 'Australia',
    'AT' : 'Austria',
    'AZ' : 'Azerbaijan',
    'BS' : 'Bahamas',
    'BH' : 'Bahrain',
    'BD' : 'Bangladesh',
    'BB' : 'Barbados',
    'BY' : 'Belarus',
    'BE' : 'Belgium',
    'BZ' : 'Belize',
    'BJ' : 'Benin',
    'BM' : 'Bermuda',
    'BT' : 'Bhutan',
    'BO' : 'Bolivia',
    'BA' : 'Bosnia And Herzegovina',
    'BW' : 'Botswana',
    'BV' : 'Bouvet Island',
    'BR' : 'Brazil',
    'IO' : 'British Indian Ocean Territory',
    'BN' : 'Brunei Darussalam',
    'BG' : 'Bulgaria',
    'BF' : 'Burkina Faso',
    'BI' : 'Burundi',
    'KH' : 'Cambodia',
    'CM' : 'Cameroon',
    'CA' : 'Canada',
    'CV' : 'Cape Verde',
    'KY' : 'Cayman Islands',
    'CF' : 'Central African Republic',
    'TD' : 'Chad',
    'CL' : 'Chile',
    'CN' : 'China',
    'CX' : 'Christmas Island',
    'CC' : 'Cocos (Keeling) Islands',
    'CO' : 'Colombia',
    'KM' : 'Comoros',
    'CG' : 'Congo',
    'CD' : 'Congo, Democratic Republic',
    'CK' : 'Cook Islands',
    'CR' : 'Costa Rica',
    'CI' : 'Cote D\'Ivoire',
    'HR' : 'Croatia',
    'CU' : 'Cuba',
    'CY' : 'Cyprus',
    'CZ' : 'Czech Republic',
    'DK' : 'Denmark',
    'DJ' : 'Djibouti',
    'DM' : 'Dominica',
    'DO' : 'Dominican Republic',
    'EC' : 'Ecuador',
    'EG' : 'Egypt',
    'SV' : 'El Salvador',
    'GQ' : 'Equatorial Guinea',
    'ER' : 'Eritrea',
    'EE' : 'Estonia',
    'ET' : 'Ethiopia',
    'FK' : 'Falkland Islands (Malvinas)',
    'FO' : 'Faroe Islands',
    'FJ' : 'Fiji',
    'FI' : 'Finland',
    'FR' : 'France',
    'GF' : 'French Guiana',
    'PF' : 'French Polynesia',
    'TF' : 'French Southern Territories',
    'GA' : 'Gabon',
    'GM' : 'Gambia',
    'GE' : 'Georgia',
    'DE' : 'Germany',
    'GH' : 'Ghana',
    'GI' : 'Gibraltar',
    'GR' : 'Greece',
    'GL' : 'Greenland',
    'GD' : 'Grenada',
    'GP' : 'Guadeloupe',
    'GU' : 'Guam',
    'GT' : 'Guatemala',
    'GG' : 'Guernsey',
    'GN' : 'Guinea',
    'GW' : 'Guinea-Bissau',
    'GY' : 'Guyana',
    'HT' : 'Haiti',
    'HM' : 'Heard Island & Mcdonald Islands',
    'VA' : 'Holy See (Vatican City State)',
    'HN' : 'Honduras',
    'HK' : 'Hong Kong',
    'HU' : 'Hungary',
    'IS' : 'Iceland',
    'IN' : 'India',
    'ID' : 'Indonesia',
    'IR' : 'Iran, Islamic Republic Of',
    'IQ' : 'Iraq',
    'IE' : 'Ireland',
    'IM' : 'Isle Of Man',
    'IL' : 'Israel',
    'IT' : 'Italy',
    'JM' : 'Jamaica',
    'JP' : 'Japan',
    'JE' : 'Jersey',
    'JO' : 'Jordan',
    'KZ' : 'Kazakhstan',
    'KE' : 'Kenya',
    'KI' : 'Kiribati',
    'KR' : 'Korea',
    'KW' : 'Kuwait',
    'KG' : 'Kyrgyzstan',
    'LA' : 'Lao People\'s Democratic Republic',
    'LV' : 'Latvia',
    'LB' : 'Lebanon',
    'LS' : 'Lesotho',
    'LR' : 'Liberia',
    'LY' : 'Libyan Arab Jamahiriya',
    'LI' : 'Liechtenstein',
    'LT' : 'Lithuania',
    'LU' : 'Luxembourg',
    'MO' : 'Macao',
    'MK' : 'Macedonia',
    'MG' : 'Madagascar',
    'MW' : 'Malawi',
    'MY' : 'Malaysia',
    'MV' : 'Maldives',
    'ML' : 'Mali',
    'MT' : 'Malta',
    'MH' : 'Marshall Islands',
    'MQ' : 'Martinique',
    'MR' : 'Mauritania',
    'MU' : 'Mauritius',
    'YT' : 'Mayotte',
    'MX' : 'Mexico',
    'FM' : 'Micronesia, Federated States Of',
    'MD' : 'Moldova',
    'MC' : 'Monaco',
    'MN' : 'Mongolia',
    'ME' : 'Montenegro',
    'MS' : 'Montserrat',
    'MA' : 'Morocco',
    'MZ' : 'Mozambique',
    'MM' : 'Myanmar',
    'NA' : 'Namibia',
    'NR' : 'Nauru',
    'NP' : 'Nepal',
    'NL' : 'Netherlands',
    'AN' : 'Netherlands Antilles',
    'NC' : 'New Caledonia',
    'NZ' : 'New Zealand',
    'NI' : 'Nicaragua',
    'NE' : 'Niger',
    'NG' : 'Nigeria',
    'NU' : 'Niue',
    'NF' : 'Norfolk Island',
    'MP' : 'Northern Mariana Islands',
    'NO' : 'Norway',
    'OM' : 'Oman',
    'PK' : 'Pakistan',
    'PW' : 'Palau',
    'PS' : 'Palestinian Territory, Occupied',
    'PA' : 'Panama',
    'PG' : 'Papua New Guinea',
    'PY' : 'Paraguay',
    'PE' : 'Peru',
    'PH' : 'Philippines',
    'PN' : 'Pitcairn',
    'PL' : 'Poland',
    'PT' : 'Portugal',
    'PR' : 'Puerto Rico',
    'QA' : 'Qatar',
    'RE' : 'Reunion',
    'RO' : 'Romania',
    'RU' : 'Russian Federation',
    'RW' : 'Rwanda',
    'BL' : 'Saint Barthelemy',
    'SH' : 'Saint Helena',
    'KN' : 'Saint Kitts And Nevis',
    'LC' : 'Saint Lucia',
    'MF' : 'Saint Martin',
    'PM' : 'Saint Pierre And Miquelon',
    'VC' : 'Saint Vincent And Grenadines',
    'WS' : 'Samoa',
    'SM' : 'San Marino',
    'ST' : 'Sao Tome And Principe',
    'SA' : 'Saudi Arabia',
    'SN' : 'Senegal',
    'RS' : 'Serbia',
    'SC' : 'Seychelles',
    'SL' : 'Sierra Leone',
    'SG' : 'Singapore',
    'SK' : 'Slovakia',
    'SI' : 'Slovenia',
    'SB' : 'Solomon Islands',
    'SO' : 'Somalia',
    'ZA' : 'South Africa',
    'GS' : 'South Georgia And Sandwich Isl.',
    'ES' : 'Spain',
    'LK' : 'Sri Lanka',
    'SD' : 'Sudan',
    'SR' : 'Suriname',
    'SJ' : 'Svalbard And Jan Mayen',
    'SZ' : 'Swaziland',
    'SE' : 'Sweden',
    'CH' : 'Switzerland',
    'SY' : 'Syrian Arab Republic',
    'TW' : 'Taiwan',
    'TJ' : 'Tajikistan',
    'TZ' : 'Tanzania',
    'TH' : 'Thailand',
    'TL' : 'Timor-Leste',
    'TG' : 'Togo',
    'TK' : 'Tokelau',
    'TO' : 'Tonga',
    'TT' : 'Trinidad And Tobago',
    'TN' : 'Tunisia',
    'TR' : 'Turkey',
    'TM' : 'Turkmenistan',
    'TC' : 'Turks And Caicos Islands',
    'TV' : 'Tuvalu',
    'UG' : 'Uganda',
    'UA' : 'Ukraine',
    'AE' : 'United Arab Emirates',
    'GB' : 'United Kingdom',
    'US' : 'United States',
    'UM' : 'United States Outlying Islands',
    'UY' : 'Uruguay',
    'UZ' : 'Uzbekistan',
    'VU' : 'Vanuatu',
    'VE' : 'Venezuela',
    'VN' : 'Viet Nam',
    'VG' : 'Virgin Islands, British',
    'VI' : 'Virgin Islands, U.S.',
    'WF' : 'Wallis And Futuna',
    'EH' : 'Western Sahara',
    'YE' : 'Yemen',
    'ZM' : 'Zambia',
    'ZW' : 'Zimbabwe',
    'UK' : 'United Kingdom'
};

function getCountryName (countryCode) {
    if (isoCountries.hasOwnProperty(countryCode)) {
        return isoCountries[countryCode];
    } else {
        return countryCode;
    }
}
