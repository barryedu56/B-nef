# PyMySQL en remplacement de mysqlclient (installation simple sous Windows / WAMP).
import pymysql

# Django >= 4.2 exige "mysqlclient >= 1.4.3" ; on fait croire à cette version.
pymysql.version_info = (1, 4, 3, "final", 0)
pymysql.install_as_MySQLdb()
