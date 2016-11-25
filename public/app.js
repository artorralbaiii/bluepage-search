(function () {

    var app = angular.module('myApp', ['ngRoute']);

    app.config(function ($routeProvider, $locationProvider) {
        $routeProvider

            .when('/', {
            templateUrl: 'login.html',
            controller: 'loginController',
            controllerAs: 'vm'
        })

        .when('/home', {
            templateUrl: 'home.html',
            controller: 'homeController',
            controllerAs: 'vm',
            resolve: {
                loggedUser: function (session, $location) {
                    if (session.getSession()) {
                        return session.getSession();
                    } else {
                        return session.getServerSession()
                            .then(function (data) {
                                if (data) {
                                    return data;
                                } else {
                                    $location.path('/');
                                }
                            });
                    }
                }
            }
        })

        .otherwise({
            redirectTo: '/'
        });

    });

    app.controller('loginController', function (dataservice, $location, session) {

        var vm = this;
        vm.creds = {};
        vm.errorMessage = '';
        vm.hasError = false;
        vm.login = login;
        vm.processing = false;

        //////////

        function login() {

            vm.hasError = false;
            vm.processing = true;

            dataservice.login(vm.creds)
                .then(function (data) {
                    if (data.success) {
                        session.setSession(data.user);
                        $location.path('/home');
                    } else {
                        vm.errorMessage = data.message;
                        vm.hasError = true;
                        vm.processing = false;
                    }
                });
        }

    });

    app.controller('homeController', function (dataservice, loggedUser) {
        var vm = this;
        vm.loggedUser = loggedUser;
        vm.search = search;
        vm.searchResults = [];
        vm.selectedItem = {};
        vm.selectItem = selectItem;
        vm.showSearch = false;
        vm.showSelected = false;

        //////////

        function search(searchString) {
            
            vm.selectedItem = {};
            vm.showSelected = false;
            vm.showSearch = true;
            
            if (searchString.trim() === '') {
                vm.searchResults = [];
                return;
            }
            
            dataservice.searchName(searchString)
                .then(function (data) {
                    vm.searchResults = data;
                });
        }
        
        function selectItem(data) {
            vm.searchText = '';
            vm.showSearch = false;
            vm.showSelected = true;
            vm.selectedItem = data;
        }

    });

    app.factory('dataservice', function ($http, $log) {
        var service = {
            login: login,
            searchName: searchName
        }

        return service;

        /////////

        function login(data) {
            return $http.post('/login', data)
                .then(function (data) {
                    return data.data;
                })
                .catch(function (message) {
                    $log.error(message);
                });
        }

        function searchName(data) {
            return $http.get('/bluepageSearch/' + data)
                .then(function (data) {
                    return data.data;
                })
                .catch(function (message) {
                    $log.error(message);
                })
        }



    });

    app.factory('session', function ($http, $log) {

        var session = null;

        var service = {
            getServerSession: getServerSession,
            getSession: getSession,
            setSession: setSession
        }

        return service;

        //////////

        function getServerSession() {
            return $http.get('/session')
                .then(function (data) {
                    return data.data;
                })
                .catch(function (message) {
                    $log(message);
                });
        }

        function getSession() {
            return session;
        }

        function setSession(data) {
            session = data;
        }

    });

})();