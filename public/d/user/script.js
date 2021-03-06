

angular.module('userDirective', [])
.controller('userDirectiveControllerMain', ['$scope', '$http', '$timeout', function($scope, $http, $timeout) {

  // console.log($scope.switchMode);
  // console.log($scope.userType);
  // console.log($scope.userEmail);
  if($scope.userModel === undefined || $scope.userModel === "")
    $scope.showFlag = "none";
  else
    $scope.showFlag = "user";

  $scope.getUser = function(){
    var url= "";
    if($scope.userId!="" && $scope.userId!=undefined){
      // $scope.showFlag = "none";
      // return;
      url='/api/v1/secure/admin/users/' + $scope.userId;
    }
    
    if ($scope.userEmail!="" && $scope.userEmail!=undefined) {
      url='/api/v1/secure/admin/users/email/' + $scope.userEmail.toLowerCase();
    }

    // if ($scope.userEmail =="" && $scope.notNull!="") {
    //     url='/api/v1/secure/admin/users/email/' + $scope.userEmail.toLowerCase();
    //     $scope.userEmail = undefined;
    //     $scope.userId = undefined;
    //   }
    if($scope.switchMode == 'add' && ($scope.moduleType == 'sessions' || $scope.moduleType == 'keynotes'))
    {
      if ($scope.userEmail == "") {
        url='/api/v1/secure/admin/users/email/' + $scope.userEmail.toLowerCase();
        $scope.userEmail = undefined;
        $scope.userId = undefined;
      }
    }
    if($scope.switchMode == 'edit' && ($scope.moduleType == 'sessions'))
    {
      if ($scope.userEmail =="" && $scope.userId!=null) {
        url='/api/v1/secure/admin/users/' + $scope.userId;
      }

      if ($scope.userEmail =="" && $scope.notNull!="") {
        url='/api/v1/secure/admin/users/email/' + $scope.userEmail.toLowerCase();
        $scope.userEmail = undefined;
        $scope.userId = undefined;
      }
    }
    // else{
    //     message = "Invalid User Id/email";
    //     return;
    // }

    $http.get(url).success(function(response) {

      if($scope.userType == response.association){
        $scope.userModel = response;
        $scope.userId = response._id;
        $scope.userEmail = response.email;
        $scope.showFlag = "user";
      }

      else{
        $scope.showFlag = "noUser";
        $scope.message = "User is not an organization employee!!";
        $timeout(function () { $scope.message = ''; }, 3000);

      }

    })
    .error(function(response, status){
      $scope.showFlag = "noUser";
      if(status===404)
      {
        $scope.message = "User is not an organization employee!!";
        $timeout(function () { $scope.message = ''; }, 3000);

      }
      else
      {
        console.log("error with user directive");
        $scope.userId = undefined;
      }
    });
  } // end of getUser method
  
  if($scope.switchMode == 'edit')
  {  
   if($scope.userId)
   { 
	 $scope.getUser(); // autoload data
 }
 $scope.showFlag = "user";
}

$scope.inputChanged = function() {
 $scope.console10 = $scope.userEmail;
 if($scope.console10 == null || $scope.console10 == undefined || $scope.console10 == '')
 {
  $scope.userModel = null;
  $scope.userEmail = null;
  $scope.userId = null;
}
}

  //ToDo: User Picker not working with inline editing.
}])

.directive('user', function() {
  return {
    controller: 'userDirectiveControllerMain',
    templateUrl: '/public/d/user/templates/user-picker.html',
    scope: {
      userModel: "=userModel",
      userId: "=userId",
      userEmail: "=userEmail",
      viewType: "=viewType",
      switchMode: "=switchMode",
      userType: "@userType",
      moduleType: "@moduleType"
    },

    link : function(scope,element,attrs)
    {
      scope.getTemplate = function(){

        var viewmode = scope.viewType.toLowerCase();

        if(viewmode === "small" && scope.userEmail!="")
        {
          return "/public/d/user/templates/smallpanel.html";
        }
        if(viewmode === "large"){
          return "/public/d/user/templates/largepanel.html";
        }
        if(viewmode === "medium"){
          return "/public/d/user/templates/mediumpanel.html";
        }

      }
    }


  };
});
